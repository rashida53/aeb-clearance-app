const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const achSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        accountNumber: {
            type: String,
            default: null,
        },
        routingNumber: {
            type: String,
            default: null,
        },
        authorized: {
            type: Boolean,
            default: false,
        },
        check: {
            type: String,
            default: null,
        },
        signature: {
            type: String,
            default: null,
        },
    },
    {
        collection: 'ach',
    }
);

const ACH = clearanceDb.model('ACH', achSchema);

module.exports = ACH;
