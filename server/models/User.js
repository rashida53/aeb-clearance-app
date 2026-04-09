const { fmbDb } = require('../config/connection');
const { Schema } = require('mongoose');

const userSchema = new Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        spouseName: {
            type: String,
        },
        hofIts: {
            type: String,
            required: true,
            unique: true,
        },
        zone: {
            type: String,
            required: true,
        },
        pickupGroup: {
            type: String,
        },
        isActive: {
            type: Boolean,
        },
        roles: [{ type: String }],
    },
    {
        toJSON: { virtuals: true },
    }
);

const User = fmbDb.model('User', userSchema);

module.exports = User;
