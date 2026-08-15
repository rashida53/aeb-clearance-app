const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const achSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        accountNumber: {
            type: String,
            default: null,
        },
        routingNumber: {
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
