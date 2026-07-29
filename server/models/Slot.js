const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const slotSchema = new Schema(
    {
        date: {
            type: Date,
            required: true,
        },
        startTime: {
            type: String,
            required: true,
        },
        endTime: {
            type: String,
            required: true,
        },
        bookedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        group: {
            type: String,
            default: null,
        },
        volunteer: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        collection: 'slots',
    }
);

const Slot = clearanceDb.model('Slot', slotSchema);

module.exports = Slot;
