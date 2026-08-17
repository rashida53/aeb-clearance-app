const fs = require('fs');
const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');

// QuickBooks integration for the clearance app. Mirrors the working OAuth2 +
// node-quickbooks setup from the fmb import script. Reuses the same OAuth app
// and (by default) the same rotating token file, so no separate re-auth is
// needed for READS. Writing invoices additionally requires the token to carry
// the com.intuit.quickbooks.accounting scope.
const clientId = process.env.QUICKBOOKS_CLIENT_ID;
const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'production';
const realmId = process.env.QUICKBOOKS_REALM_ID;
const tokensFile = process.env.QB_TOKENS_FILE;
const useSandbox = environment === 'sandbox';

let qbo;

function loadTokens() {
    return JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
}
function saveTokens(t) {
    fs.writeFileSync(tokensFile, JSON.stringify(t, null, 2));
}

function promisify(fn, ctx) {
    return (...args) =>
        new Promise((resolve, reject) =>
            fn.call(ctx, ...args, (err, res) => (err ? reject(err) : resolve(res)))
        );
}

// Initialize once: refresh the access token (rotating the refresh token back to
// the shared file) and build the QuickBooks client.
async function getQbo() {
    if (qbo) return qbo;
    if (!clientId || !clientSecret || !realmId || !tokensFile) {
        throw new Error(
            'QuickBooks is not configured (need QUICKBOOKS_CLIENT_ID/SECRET/REALM_ID and QB_TOKENS_FILE in server/.env).'
        );
    }
    const tokens = loadTokens();
    const oauthClient = new OAuthClient({
        clientId,
        clientSecret,
        environment,
        redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3001/auth/callback',
    });
    // Exact token shape used by fmb/scripts/clearance.js (the proven, working
    // connection). Omitting x_refresh_token_expires_in caused refresh to fail.
    oauthClient.setToken({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: 'bearer',
        expires_in: 3600,
        x_refresh_token_expires_in: 8726400,
    });
    const refreshed = (await oauthClient.refresh()).getJson();
    saveTokens({
        ...tokens,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_type: refreshed.token_type,
        expires_in: refreshed.expires_in,
        updated_at: new Date().toISOString(),
    });
    qbo = new QuickBooks(
        clientId,
        clientSecret,
        refreshed.access_token,
        false, // no OAuth1 token secret
        realmId,
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
