const { fmbDb } = require('../config/connection');
const { Schema } = require('mongoose');

const miqaatSchema = new Schema(
    {
        title: {
            type: String,
        },
        date: {
            type: Date,
        },
        hijriDate: {
            type: String,
        },
        hosts: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
    },
    {
        collection: 'miqaats',
    }
);

const Miqaat = fmbDb.model('Miqaat', miqaatSchema);

module.exports = Miqaat;
