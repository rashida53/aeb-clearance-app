const { fmbDb } = require('../config/connection');
const { Schema } = require('mongoose');

const pledgeSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        period: {
            type: String,
        },
        amount: {
            type: Number,
        },
        isPaid: {
            type: Boolean,
        },
        status: {
            type: String,
        },
    },
    {
        collection: 'pledges',
    }
);

const Pledge = fmbDb.model('Pledge', pledgeSchema);

module.exports = Pledge;
