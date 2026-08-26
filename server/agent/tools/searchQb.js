const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { getQbo } = require('../qb');

function promisify(fn, ctx) {
    return (...args) =>
        new Promise((resolve, reject) =>
            fn.call(ctx, ...args, (err, res) => (err ? reject(err) : resolve(res)))
        );
}

const searchQb = tool(
    async ({ query }) => {
        try {
            const qbo = await getQbo();
            const result = await promisify(qbo.query, qbo)(query);
            return JSON.stringify(result?.QueryResponse || result, null, 2);
        } catch (err) {
            return JSON.stringify({ error: err.message || String(err) });
        }
    },
    {
        name: 'search_quickbooks',
        description:
            'Run a QuickBooks query (QBO Query Language) against the production QuickBooks account. ' +
            'Use this to look up invoices, customers, payments, and items. ' +
            'Examples:\n' +
            '  "SELECT * FROM Invoice WHERE DocNumber LIKE \'KR-1448%\'"\n' +
            '  "SELECT * FROM Invoice WHERE CustomerRef = \'123\'"\n' +
            '  "SELECT * FROM Customer WHERE DisplayName LIKE \'%Rawat%\'"\n' +
            '  "SELECT Id, DisplayName FROM Customer MAXRESULTS 1000"\n' +
            '  "SELECT * FROM Invoice WHERE TotalAmt > \'0\' AND DocNumber LIKE \'Sabil%\'"\n' +
            '  "SELECT * FROM Payment WHERE CustomerRef = \'123\'"\n' +
            'The query language is SQL-like. Supported entities: Invoice, Customer, Item, Payment, Estimate. ' +
            'Use LIKE for partial matches, single quotes for string values. MAXRESULTS defaults to 100.',
        schema: z.object({
            query: z.string().describe('A QBO Query Language string (SQL-like)'),
        }),
    }
);

module.exports = searchQb;
