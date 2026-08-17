const fs = require('fs');
const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const { clearanceDb } = require('../config/connection');
const { encrypt, decrypt } = require('../utils/encryption');

// QuickBooks integration for the clearance app. Mirrors the working OAuth2 +
// node-quickbooks setup from the fmb import script (same OAuth app, same token
// shape). The OAuth token is persisted durably in Mongo (clearanceDb.qb_tokens)
// with access/refresh tokens encrypted at rest via the same AES helper used for
// ACH — so it survives Heroku restarts/dynos and is never on disk. The token
// collection is NOT in the agent's queryable whitelist, so the assistant can
// never read it. Writing invoices requires the token to carry the
// com.intuit.quickbooks.accounting scope.
const clientId = process.env.QUICKBOOKS_CLIENT_ID;
const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'production';
const realmId = process.env.QUICKBOOKS_REALM_ID;
const useSandbox = environment === 'sandbox';

const TOKEN_COLLECTION = 'qb_tokens';
const TOKEN_KEY = 'quickbooks';

let qbo;

async function tokenColl() {
    await clearanceDb.asPromise();
    return clearanceDb.db.collection(TOKEN_COLLECTION);
}

// Bootstrap source, used ONLY when Mongo has no token yet: a local token file
// (dev convenience) or the QB_REFRESH_TOKEN env var (prod). After the first
// save, Mongo is the source of truth and these are ignored.
function seedTokens() {
    const file = process.env.QB_TOKENS_FILE;
    if (file && fs.existsSync(file)) {
        const t = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { access_token: t.access_token || null, refresh_token: t.refresh_token, realmId: t.realmId || realmId };
    }
    if (process.env.QB_REFRESH_TOKEN) {
        return { access_token: null, refresh_token: process.env.QB_REFRESH_TOKEN, realmId };
    }
    return null;
}

async function loadTokens() {
    const coll = await tokenColl();
    const doc = await coll.findOne({ _id: TOKEN_KEY });
    if (doc && doc.refreshToken) {
        return {
            access_token: doc.accessToken ? decrypt(doc.accessToken) : null,
            refresh_token: decrypt(doc.refreshToken),
            realmId: doc.realmId || realmId,
        };
    }
    const seed = seedTokens();
    if (!seed || !seed.refresh_token) {
        throw new Error(
            'No QuickBooks token stored and no seed available. Set QB_REFRESH_TOKEN (or QB_TOKENS_FILE for local dev) to bootstrap.'
        );
    }
    return seed;
}

async function saveTokens(t) {
    const coll = await tokenColl();
    await coll.updateOne(
        { _id: TOKEN_KEY },
        {
            $set: {
                accessToken: t.access_token ? encrypt(t.access_token) : null,
                refreshToken: encrypt(t.refresh_token),
                realmId: t.realmId || realmId,
                tokenType: t.token_type || 'bearer',
                expiresIn: t.expires_in || null,
                updatedAt: new Date(),
            },
        },
        { upsert: true }
    );
}

function promisify(fn, ctx) {
    return (...args) =>
        new Promise((resolve, reject) =>
            fn.call(ctx, ...args, (err, res) => (err ? reject(err) : resolve(res)))
        );
}

// Initialize once: load the token from Mongo (seeding it there on first use),
// refresh the access token, persist the rotated token back (encrypted), and
// build the QuickBooks client.
async function getQbo() {
    if (qbo) return qbo;
    if (!clientId || !clientSecret || !realmId) {
        throw new Error(
            'QuickBooks is not configured (need QUICKBOOKS_CLIENT_ID/SECRET/REALM_ID in server/.env).'
        );
    }
    const tokens = await loadTokens();
    const oauthClient = new OAuthClient({
        clientId,
        clientSecret,
        environment,
        redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    });
    // Exact token shape used by fmb/scripts/clearance.js (the proven, working
    // connection). Omitting x_refresh_token_expires_in caused refresh to fail.
    oauthClient.setToken({
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token,
        token_type: 'bearer',
        expires_in: 3600,
        x_refresh_token_expires_in: 8726400,
    });
    const refreshed = (await oauthClient.refresh()).getJson();
    await saveTokens({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_type: refreshed.token_type,
        expires_in: refreshed.expires_in,
        realmId: tokens.realmId,
    });
    qbo = new QuickBooks(
        clientId,
        clientSecret,
        refreshed.access_token,
        false, // no OAuth1 token secret
        tokens.realmId || realmId,
        useSandbox,
        false,
        null,
        '2.0',
        refreshed.refresh_token
    );
    return qbo;
}

// ── Read helpers ──

async function findItems() {
    const q = await getQbo();
    const r = await promisify(q.findItems, q)({ fetchAll: true, limit: 1000 });
    return r?.QueryResponse?.Item || [];
}

async function findInvoiceByDocNumber(docNumber) {
    const q = await getQbo();
    const r = await promisify(q.findInvoices, q)([{ field: 'DocNumber', value: docNumber }]);
    const list = r?.QueryResponse?.Invoice || [];
    return list[0] || null;
}

let customerByIts;
function extractIts(c) {
    const fields = [
        c.DisplayName,
        c.CompanyName,
        c.FullyQualifiedName,
        c.Notes,
        c.PrimaryPhone && c.PrimaryPhone.FreeFormNumber,
    ];
    for (const f of fields) {
        const m = f && String(f).match(/\b\d{8}\b/);
        if (m) return m[0];
    }
    return null;
}

// Resolve a household's QB customer by the 8-digit ITS embedded in the customer
// record — the same heuristic the fmb import uses. Cached per process.
async function findCustomerByIts(its) {
    if (!customerByIts) {
        const q = await getQbo();
        const r = await promisify(q.findCustomers, q)({ fetchAll: true, limit: 1000 });
        const all = r?.QueryResponse?.Customer || [];
        customerByIts = new Map();
        for (const c of all) {
            const i = extractIts(c);
            if (i) customerByIts.set(i, c);
        }
    }
    return customerByIts.get(String(its)) || null;
}

// ── Write helper ──

async function createInvoice(invoice) {
    const q = await getQbo();
    return promisify(q.createInvoice, q)(invoice);
}

module.exports = { getQbo, findItems, findInvoiceByDocNumber, findCustomerByIts, createInvoice };
