import React from 'react';

const compactFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
});

export const formatCompactCurrency = (amount) => compactFormatter.format(amount || 0);

const NiyyatAmount = ({ full, short }) => (
    <span className="niyyatMilestoneAmt">
        <span className="niyyatAmtFull">{full}</span>
        <span className="niyyatAmtShort">{short}</span>
    </span>
);

export default NiyyatAmount;
