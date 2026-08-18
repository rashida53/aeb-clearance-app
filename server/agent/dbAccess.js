const { Types } = require('mongoose');
const { clearanceDb, fmbDb } = require('../config/connection');

// Whitelist: collection name -> which database connection owns it.
// Anything not listed here cannot be queried by the agent. `members` (bcrypt
// passwords + email) and `ach` (encrypted account/routing) are deliberately
// omitted so the agent can never read them.
const COLLECTIONS = {
    // fmb database (community app owns/populates these)
    users: 'fmb',
    miqaats: 'fmb',
    rsvps: 'fmb',
    events: 'fmb',
    eventrsvps: 'fmb',
    invitees: 'fmb',
    pledges: 'fmb',
    qbopens: 'fmb',
    pickupgroups: 'fmb',
    menuitems: 'fmb',
    dishes: 'fmb',
    cooks: 'fmb',
    signups: 'fmb',
    feedbacks: 'fmb',
    // clearance database (this app's own writes)
    approvals: 'clr',
    letters: 'clr',
    masjid: 'clr',
    slots: 'clr',
    localniyyats: 'clr',
    huqooq: 'clr',
};

// Extra defense-in-depth: strip these fields from any returned document even if
// a whitelisted collection somehow contained them.
const SENSITIVE_FIELDS = ['password', 'accountNumber', 'routingNumber'];

// Operators that can write, run arbitrary JS, or exfiltrate — never allowed.
const FORBIDDEN_OPERATORS = ['$where', '$function', '$accumulator', '$out', '$merge'];

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

function isWhitelisted(collection) {
    return Object.prototype.hasOwnProperty.call(COLLECTIONS, collection);
}

async function getCollection(collection) {
    if (!isWhitelisted(collection)) {
        throw new Error(
            `Collection "${collection}" is not queryable. Allowed: ${Object.keys(COLLECTIONS).join(', ')}`
        );
    }
    const conn = COLLECTIONS[collection] === 'fmb' ? fmbDb : clearanceDb;
    await conn.asPromise(); // resolves immediately if already connected
    return { coll: conn.db.collection(collection), db: COLLECTIONS[collection] };
}

// Recursively convert the explicit ObjectId marker {$oid: "<24hex>"} into a real
// ObjectId, anywhere in a filter or pipeline. This is how the LLM (which only
// emits JSON) references _id / ref fields: it passes {"$oid": "..."} and we
// coerce it here.
function coerceOids(value) {
    if (Array.isArray(value)) return value.map(coerceOids);
    if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 1 && keys[0] === '$oid' && typeof value.$oid === 'string') {
            if (!/^[a-fA-F0-9]{24}$/.test(value.$oid)) {
                throw new Error(`Invalid $oid "${value.$oid}" (must be 24 hex chars).`);
            }
            return new Types.ObjectId(value.$oid);
        }
        // {"$date": "ISO string"} -> a real Date, so date-range filters work.
        if (keys.length === 1 && keys[0] === '$date' && typeof value.$date === 'string') {
            const d = new Date(value.$date);
            if (isNaN(d.getTime())) throw new Error(`Invalid $date "${value.$date}".`);
            return d;
        }
        const out = {};
        for (const k of keys) out[k] = coerceOids(value[k]);
        return out;
    }
    return value;
}

// Walk any object/array and throw if a forbidden operator key appears.
function assertNoForbiddenOperators(node) {
    if (Array.isArray(node)) {
        node.forEach(assertNoForbiddenOperators);
        return;
    }
    if (node && typeof node === 'object') {
        for (const key of Object.keys(node)) {
            if (FORBIDDEN_OPERATORS.includes(key)) {
                throw new Error(`Operator ${key} is not allowed (read-only).`);
            }
            assertNoForbiddenOperators(node[key]);
        }
    }
}

// Validate an aggregation pipeline: no write/JS stages, and any $lookup must
// target a whitelisted collection in the SAME database (the two DBs are separate
// connections, so cross-DB $lookup is impossible anyway).
function assertReadOnlyPipeline(pipeline, baseDb) {
    if (!Array.isArray(pipeline)) throw new Error('pipeline must be an array of stages.');
    assertNoForbiddenOperators(pipeline);
    for (const stage of pipeline) {
        const lookup = stage && stage.$lookup;
        if (lookup && lookup.from) {
            if (!isWhitelisted(lookup.from)) {
                throw new Error(`$lookup.from "${lookup.from}" is not a queryable collection.`);
            }
            if (COLLECTIONS[lookup.from] !== baseDb) {
                throw new Error(
                    `$lookup cannot cross databases ("${lookup.from}" is in a different DB).`
                );
            }
        }
    }
}

function redact(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    const clone = Array.isArray(doc) ? doc.map(redact) : { ...doc };
    if (!Array.isArray(clone)) {
        for (const f of SENSITIVE_FIELDS) delete clone[f];
    }
    return clone;
}

function clampLimit(n) {
    const parsed = Number(n);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.min(Math.floor(parsed), MAX_LIMIT);
}

module.exports = {
    COLLECTIONS,
    MAX_LIMIT,
    DEFAULT_LIMIT,
    getCollection,
    coerceOids,
    assertNoForbiddenOperators,
    assertReadOnlyPipeline,
    redact,
    clampLimit,
};
