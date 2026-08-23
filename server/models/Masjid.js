const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const masjidSchema = new Schema(
    {
        its: {
            type: String,
            required: true,
            unique: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        status: {
            type: String,
            enum: ['CLEAR'],
            required: true,
        },
        t1: {
            type: Number,
        },
        t2: {
            type: Number,
        },
        adaa: {
            type: Number,
        },
        facilitator: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        collection: 'masjid',
    }
);

const Masjid = clearanceDb.model('Masjid', masjidSchema);

module.exports = Masjid;
