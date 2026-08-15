const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const commitmentSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        year: {
            type: String,
            required: true,
        },
        kr: {
            type: Number,
            default: null,
        },
        ut: {
            type: Number,
            default: null,
        },
        schedule: {
            type: String,
            default: null,
        },
    },
    {
        collection: 'localniyyats',
    }
);

const Commitment = clearanceDb.model('Commitment', commitmentSchema);

module.exports = Commitment;
