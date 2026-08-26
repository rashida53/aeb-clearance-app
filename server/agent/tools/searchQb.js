const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { getQbo } = require('../qb');

function promisify(fn, ctx) {
    return (...args) =>
        new Promise((resolve, reject) =>
            fn.call(ctx, ...args, (err, res) => (err ? reject(err) : resolve(res)))
        );
}

const ENTITY_METHODS = {
    invoice: 'findInvoices',
    customer: 'findCustomers',
    item: 'findItems',
    payment: 'findPayments',
    estimate: 'findEstimates',
    bill: 'findBills',
    account: 'findAccounts',
    vendor: 'findVendors',
    creditmemo: 'findCreditMemos',
    deposit: 'findDeposits',
    purchase: 'findPurchases',
    salesreceipt: 'findSalesReceipts',
};

const searchQb = tool(
    async ({ entity, criteria, fetchAll }) => {
        try {
            const qbo = await getQbo();
            const method = ENTITY_METHODS[entity.toLowerCase()];
            if (!method) {
                return JSON.stringify({ error: `Unknown entity "${entity}". Supported: ${Object.keys(ENTITY_METHODS).join(', ')}` });
            }
            const opts = criteria && criteria.length ? [...criteria] : [];
            if (fetchAll) opts.push({ fetchAll: true });
            const result = await promisify(qbo[method], qbo)(opts.length ? opts : { fetchAll: !!fetchAll });
            const key = entity.charAt(0).toUpperCase() + entity.slice(1).toLowerCase();
            const items = result?.QueryResponse?.[key] || result?.QueryResponse || [];
            return JSON.stringify({ count: Array.isArray(items) ? items.length : undefined, results: items }, null, 2);
        } catch (err) {
            return JSON.stringify({ error: err.message || String(err) });
        }
    },
    {
        name: 'search_quickbooks',
        description:
            'Search QuickBooks for invoices, customers, payments, items, etc. ' +
            'Pass an entity name and optional criteria (array of {field, value, operator} filters). ' +
            'Each criterion becomes a WHERE clause. Operator defaults to "=" if omitted; use "LIKE" for partial matches (with % wildcards).\n' +
            'Examples:\n' +
            '  entity:"Invoice", criteria:[{field:"DocNumber", value:"KR-1448%", operator:"LIKE"}]\n' +
            '  entity:"Invoice", criteria:[{field:"CustomerRef", value:"123"}]\n' +
            '  entity:"Customer", criteria:[{field:"DisplayName", value:"%Rawat%", operator:"LIKE"}]\n' +
            '  entity:"Customer", fetchAll:true  (get all customers)\n' +
            '  entity:"Item", fetchAll:true  (list all billing categories)\n' +
            '  entity:"Payment", criteria:[{field:"CustomerRef", value:"123"}]\n' +
            'Supported entities: Invoice, Customer, Item, Payment, Estimate, Bill, Account, Vendor, CreditMemo, Deposit, Purchase, SalesReceipt.\n' +
            'To sum amounts or count, fetch the matching records and compute from the results.',
        schema: z.object({
            entity: z.string().describe('QuickBooks entity to query (e.g. "Invoice", "Customer", "Payment", "Item")'),
            criteria: z.array(z.object({
                field: z.string().describe('Field name (e.g. "DocNumber", "CustomerRef", "DisplayName", "TotalAmt")'),
                value: z.string().describe('Value to match (use % for LIKE wildcards)'),
                operator: z.string().optional().describe('Comparison operator: "=", "LIKE", ">", "<", ">=", "<=". Defaults to "="'),
            })).optional().describe('Filter criteria array. Omit for unfiltered results.'),
            fetchAll: z.boolean().optional().describe('Set true to fetch all results (no limit). Default false (returns up to 100).'),
        }),
    }
);

module.exports = searchQb;
