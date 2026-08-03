const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const takhmeenSchema = new Schema(
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
        wajebaat: {
            type: Number,
            default: null,
        },
        sf: {
            type: Number,
            default: null,
        },
    },
    {
        collection: 'takhmeen',
    }
);

takhmeenSchema.index({ user: 1, year: 1 }, { unique: true });

const Takhmeen = clearanceDb.model('Takhmeen', takhmeenSchema);

module.exports = Takhmeen;
