const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const masjidSchema = new Schema(
    {
        its: {
            type: String,
            required: true,
            unique: true,
        },
        status: {
            type: String,
            enum: ['CLEAR', 'OPTIONAL_DISCUSS', 'DISCUSS'],
            required: true,
        },
    },
    {
        collection: 'masjid',
    }
);

const Masjid = clearanceDb.model('Masjid', masjidSchema);

module.exports = Masjid;
