const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const huqooqSchema = new Schema(
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
        wajebaatAmount: {
            type: Number,
            default: null,
        },
        sfAmount: {
            type: Number,
            default: null,
        },
        wcheck: {
            type: Boolean,
            default: false,
        },
        sfcheck: {
            type: Boolean,
            default: false,
        },
    },
    {
        collection: 'huqooq',
    }
);

huqooqSchema.index({ user: 1, year: 1 }, { unique: true });

const Huqooq = clearanceDb.model('Huqooq', huqooqSchema);

module.exports = Huqooq;
