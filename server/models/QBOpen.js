const { fmbDb } = require('../config/connection');
const { Schema } = require('mongoose');

const qbOpenSchema = new Schema(
    {
        hofIts: {
            type: String,
        },
        its: {
            type: String,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        qb_id: {
            type: String,
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            required: true,
        },
        due: {
            type: String,
        },
        customer: {
            type: String,
        },
    },
    {
        collection: 'qbopens',
    }
);

const QBOpen = fmbDb.model('QBOpen', qbOpenSchema);

module.exports = QBOpen;
