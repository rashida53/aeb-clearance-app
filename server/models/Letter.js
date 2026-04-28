const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const letterSchema = new Schema(
    {
        requester: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        approver: {
            type: String,
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
    },
    {
        collection: 'letters',
        timestamps: true,
    }
);

const Letter = clearanceDb.model('Letter', letterSchema);

module.exports = Letter;
