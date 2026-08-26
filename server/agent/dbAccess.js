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

// The community's timezone. A "day" like 2026-08-24 means midnight-to-midnight
// in this zone, not UTC — so $dateDay ranges line up with how people think
// about dates locally (and with $dayOfWeek elsewhere in the agent).
const APP_TIMEZONE = 'America/Chicago';

// Given a calendar date (Y, M, D) and an IANA timezone, return the exact UTC
// instant of local midnight that day. We guess UTC midnight, ask Intl what the
// local wall-clock is at that instant, and subtract the resulting offset. This
// handles DST because the offset is computed for that specific date.
function zonedDayStartUtc(year, month, day, tz) {
    const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
            .formatToParts(new Date(utcGuess))
            .map((p) => [p.type, p.value])
    );
    // en-US formats midnight as "24" instead of "00"; normalize it.
    const hour = parts.hour === '24' ? 0 : Number(parts.hour);
    const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        hour,
        Number(parts.minute),
        Number(parts.second)
    );
    const offset = asUtc - utcGuess; // ms the zone is ahead of UTC on this date
    return new Date(utcGuess - offset);
}

// Expand a "YYYY-MM-DD" into a half-open [start, nextDayStart) range covering
// the whole local day. Returned as a Mongo range so a Date field anywhere in
// that day matches — not just those stored at exactly midnight.
function dayRange(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr).trim());
    if (!m) throw new Error(`Invalid $dateDay "${dateStr}" (expected YYYY-MM-DD).`);
    const [, y, mo, d] = m.map(Number);
    const start = zonedDayStartUtc(y, mo, d, APP_TIMEZONE);
    // Next calendar day (a UTC Date cleanly rolls month/year over); take its
    // local midnight as the exclusive upper bound. Computing the boundary from
    // the calendar date (not start + 24h) keeps it correct across DST.
    const nextDay = new Date(Date.UTC(y, mo - 1, d + 1));
    const end = zonedDayStartUtc(
        nextDay.getUTCFullYear(),
        nextDay.getUTCMonth() + 1,
        nextDay.getUTCDate(),
        APP_TIMEZONE
    );
    return { $gte: start, $lt: end };
}

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
        // {"$dateDay": "YYYY-MM-DD"} -> a {$gte, $lt} range spanning the whole
        // local calendar day, so "on <date>" matches records at ANY time that
        // day, not just those stored at exactly midnight.
        if (keys.length === 1 && keys[0] === '$dateDay' && typeof value.$dateDay === 'string') {
            return dayRange(value.$dateDay);
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
