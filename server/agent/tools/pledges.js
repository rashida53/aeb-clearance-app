const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { User, Commitment } = require('../../models');
const { findItems, findInvoiceByDocNumber, findCustomerByIts, createInvoice } = require('../qb');
const { CATEGORY_LABEL, CATEGORY_AMOUNT_FIELD, CATEGORY_ITEMS, PLEDGE_DATE } = require('../qbConfig');

const MAX_CREATES = 200; // safety cap per confirmed batch

// Order-independent, title-tolerant name match (same approach as the read tools).
function nameFilter(name) {
    const tokens = name
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return { $and: tokens.map((t) => ({ fullName: { $regex: t, $options: 'i' } })) };
}

// Build the list of {userId, hofIts, fullName, amount} we might create pledges for.
async function resolveTargets({ name, allUsers, year, amountField }) {
    if (allUsers) {
        const commitments = await Commitment.find({ year }).lean();
        const wanted = commitments.filter((c) => Number(c[amountField]) > 0);
        const users = await User.find({ _id: { $in: wanted.map((c) => c.user) } })
            .select('fullName hofIts')
            .lean();
        const byId = new Map(users.map((u) => [String(u._id), u]));
        return wanted.map((c) => {
            const u = byId.get(String(c.user));
            return { userId: c.user, hofIts: u?.hofIts, fullName: u?.fullName, amount: Number(c[amountField]) };
        });
    }
    // Single named person.
    const matches = await User.find(nameFilter(name)).select('fullName hofIts').limit(5).lean();
    if (matches.length === 0) return { error: `No user matches "${name}".` };
    if (matches.length > 1) {
        return { error: `Multiple users match "${name}": ${matches.map((m) => m.fullName).join(', ')}. Be more specific.` };
    }
    const u = matches[0];
    const c = await Commitment.findOne({ user: u._id, year }).lean();
    const amount = c ? Number(c[amountField]) : 0;
    return [{ userId: u._id, hofIts: u.hofIts, fullName: u.fullName, amount }];
}

const createPledge = tool(
    async ({ name, allUsers, category = 'kr', year = '1448-49', confirm = false }) => {
        try {
            const cat = category.toLowerCase();
            const prefix = CATEGORY_LABEL[cat];
            const amountField = CATEGORY_AMOUNT_FIELD[cat];
            const itemId = CATEGORY_ITEMS[cat];
            if (!prefix || !amountField) {
                return JSON.stringify({ error: `Unknown pledge category "${category}".` });
            }
            if (!itemId) {
                return JSON.stringify({
                    error: `No QuickBooks item is configured for "${cat}". Run list_qb_items and set CATEGORY_ITEMS in qbConfig.js first.`,
                });
            }
            if (!name && !allUsers) {
                return JSON.stringify({ error: 'Provide a person\'s name, or allUsers: true.' });
            }

            const targets = await resolveTargets({ name, allUsers, year, amountField });
            if (targets.error) return JSON.stringify({ error: targets.error });

            const hijriYear = year.split('-')[0];
            const plan = [];
            for (const t of targets) {
                const base = { name: t.fullName, hofIts: t.hofIts, amount: t.amount };
                if (!t.amount || t.amount <= 0) {
                    plan.push({ ...base, action: 'skip', reason: `no ${cat} amount in localniyyats for ${year}` });
                    continue;
                }
                if (!t.hofIts) {
                    plan.push({ ...base, action: 'skip', reason: 'no hofIts on user' });
                    continue;
                }
                const customer = await findCustomerByIts(t.hofIts);
                if (!customer) {
                    plan.push({ ...base, action: 'skip', reason: `no QuickBooks customer found for ITS ${t.hofIts}` });
                    continue;
                }
                const docNumber = `${prefix}-${hijriYear}-${t.hofIts}`;
                const existing = await findInvoiceByDocNumber(docNumber);
                if (existing) {
                    plan.push({ ...base, docNumber, action: 'skip', reason: 'already exists in QuickBooks' });
                    continue;
                }
                plan.push({ ...base, docNumber, customerId: customer.Id, action: 'create' });
            }

            // Dry-run: return the plan, write nothing.
            if (!confirm) {
                return JSON.stringify({
                    dryRun: true,
                    category: cat,
                    year,
                    toCreate: plan.filter((p) => p.action === 'create').length,
                    toSkip: plan.filter((p) => p.action === 'skip').length,
                    plan,
                });
            }

            // Confirmed: create the invoices (idempotency already applied above).
            const toCreate = plan.filter((p) => p.action === 'create').slice(0, MAX_CREATES);
            const created = [];
            const failed = [];
            for (const p of toCreate) {
                try {
                    const inv = await createInvoice({
                        DocNumber: p.docNumber,
                        CustomerRef: { value: p.customerId },
                        TxnDate: PLEDGE_DATE,
                        DueDate: PLEDGE_DATE,
                        Line: [
                            {
                                Amount: p.amount,
                                DetailType: 'SalesItemLineDetail',
                                SalesItemLineDetail: {
                                    ItemRef: { value: itemId },
                                    Qty: 1,
                                    UnitPrice: p.amount,
                                },
                            },
                        ],
                    });
                    created.push({ name: p.name, docNumber: p.docNumber, amount: p.amount, invoiceId: inv?.Id });
                } catch (err) {
                    failed.push({ name: p.name, docNumber: p.docNumber, error: err.message || String(err) });
                }
            }
            return JSON.stringify({
                created: created.length,
                skipped: plan.filter((p) => p.action === 'skip').length,
                failed: failed.length,
                cappedAt: plan.filter((p) => p.action === 'create').length > MAX_CREATES ? MAX_CREATES : undefined,
                details: { created, failed, skipped: plan.filter((p) => p.action === 'skip') },
            });
        } catch (err) {
            return JSON.stringify({ error: err.message || String(err) });
        }
    },
    {
        name: 'create_pledge',
        description:
            'Create QuickBooks pledge invoices from people\'s localniyyats (Commitment) amounts. ' +
            'Args: name (one person) OR allUsers:true (everyone with a commitment); category (default "kr"); ' +
            'year (default "1448-49"); confirm (default false). ' +
            'ALWAYS call with confirm:false first to PREVIEW (per person: amount, DocNumber, or skip reason), show the ' +
            'user, and only call again with confirm:true AFTER they explicitly approve. Idempotent: pledges already in ' +
            'QuickBooks (matched by DocNumber "<CAT>-<year>-<hofIts>") are skipped, so retries never duplicate.',
        schema: z.object({
            name: z.string().optional().describe('Full name of one person'),
            allUsers: z.boolean().optional().describe('Create for everyone with a commitment amount'),
            category: z.string().optional().describe('Pledge category, e.g. "kr" (default) or "ut"'),
            year: z.string().optional().describe('Commitment year, default "1448-49"'),
            confirm: z.boolean().optional().describe('false = preview only (default); true = actually create'),
        }),
    }
);

const listQbItems = tool(
    async () => {
        try {
            const items = await findItems();
            return JSON.stringify({ items: items.map((i) => ({ id: i.Id, name: i.Name, type: i.Type })) });
        } catch (err) {
            return JSON.stringify({ error: err.message || String(err) });
        }
    },
    {
        name: 'list_qb_items',
        description:
            'List QuickBooks items (id + name) — used to map pledge categories (KR, Sabil, ...) to their QB item ids. Read-only.',
        schema: z.object({}),
    }
);

module.exports = [createPledge, listQbItems];
