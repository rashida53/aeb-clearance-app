// Per-category configuration for creating pledges in QuickBooks.
//
// - CATEGORY_LABEL: the DocNumber prefix (e.g. kr -> "KR-1448-<hofIts>").
// - CATEGORY_AMOUNT_FIELD: which localniyyats (Commitment) field holds the amount.
// - CATEGORY_ITEMS: the QB Item id (ItemRef.value) to bill against. These are
//   DISCOVERED via the list_qb_items tool and filled in here — leave blank until then.
// DocNumber prefix per category — note it differs from the field name: the "ut"
// commitment is billed as a "Madrasa" pledge in QuickBooks.
const CATEGORY_LABEL = { kr: 'KR', ut: 'Madrasa' };

// Which localniyyats (Commitment) field holds the amount for each category.
const CATEGORY_AMOUNT_FIELD = { kr: 'kr', ut: 'ut' };

// QB Item ids (ItemRef.value), confirmed from existing invoices.
const CATEGORY_ITEMS = {
    kr: '88', // "Other:Khidmat Ramadaniyah"     (from invoice KR-1447-023)
    ut: '84', // "Madrasah:General Donation"     (from invoice Madrasa-1447-070)
};

// TxnDate + DueDate applied to created pledge invoices (this year's pledge date).
const PLEDGE_DATE = '2026-03-01';

module.exports = { CATEGORY_LABEL, CATEGORY_AMOUNT_FIELD, CATEGORY_ITEMS, PLEDGE_DATE };
