const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const {
    MAX_LIMIT,
    getCollection,
    coerceOids,
    assertNoForbiddenOperators,
    assertReadOnlyPipeline,
    redact,
    clampLimit,
} = require('../dbAccess');

// ── Generic read-only primitives (work across every whitelisted collection) ──

const findDocuments = tool(
    async ({ collection, filter, projection, sort, limit }) => {
        try {
            const { coll } = await getCollection(collection);
            const f = coerceOids(filter || {});
            assertNoForbiddenOperators(f);
            const cursor = coll
                .find(f, projection ? { projection } : {})
                .limit(clampLimit(limit));
            if (sort) cursor.sort(sort);
            const docs = await cursor.toArray();
            // ObjectId serializes to a 24-hex string and Date to ISO via JSON.
            return JSON.stringify({ collection, count: docs.length, documents: docs.map(redact) });
        } catch (err) {
            return JSON.stringify({ error: err.message });
        }
    },
    {
        name: 'find_documents',
        description:
            'Read documents from a collection. filter is a MongoDB query object. ' +
            'To match an _id or a reference field (user, miqaat, event, host, ...), pass the id as {"$oid": "<24-hex>"}. ' +
            `Returns at most ${MAX_LIMIT} documents. Read-only.`,
        schema: z.object({
            collection: z.string().describe('Collection name, e.g. "users" or "rsvps"'),
            filter: z.record(z.any()).optional().describe('MongoDB filter object'),
            projection: z.record(z.any()).optional().describe('Fields to include/exclude'),
            sort: z.record(z.any()).optional().describe('Sort spec, e.g. {"fullName": 1}'),
            limit: z.number().optional().describe(`Max docs (default 25, cap ${MAX_LIMIT})`),
        }),
    }
);

const countDocuments = tool(
    async ({ collection, filter }) => {
        try {
            const { coll } = await getCollection(collection);
            const f = coerceOids(filter || {});
            assertNoForbiddenOperators(f);
            const count = await coll.countDocuments(f);
            return JSON.stringify({ collection, count });
        } catch (err) {
            return JSON.stringify({ error: err.message });
        }
    },
    {
        name: 'count_documents',
        description:
            'Count documents in a collection matching a filter. Use this for "how many" questions instead of fetching and counting. Read-only.',
        schema: z.object({
            collection: z.string(),
            filter: z.record(z.any()).optional(),
        }),
    }
);

const aggregate = tool(
    async ({ collection, pipeline }) => {
        try {
            const { coll, db } = await getCollection(collection);
            const p = coerceOids(pipeline);
            assertReadOnlyPipeline(p, db);
            p.push({ $limit: MAX_LIMIT });
            const docs = await coll.aggregate(p).toArray();
            return JSON.stringify({ collection, count: docs.length, documents: docs.map(redact) });
        } catch (err) {
            return JSON.stringify({ error: err.message });
        }
    },
    {
        name: 'aggregate',
        description:
            'Run a read-only MongoDB aggregation pipeline on a collection. Use for group-bys and ' +
            'joins ($lookup) between collections in the SAME database. Wrap ObjectIds as {"$oid": "<hex>"}. ' +
            '$out/$merge/$where/$function are blocked.',
        schema: z.object({
            collection: z.string(),
            pipeline: z.array(z.record(z.any())).describe('Aggregation stages'),
        }),
    }
);

module.exports = [findDocuments, countDocuments, aggregate];
