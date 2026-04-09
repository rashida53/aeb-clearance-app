const bcrypt = require('bcrypt');
const { fmbDb } = require('../config/connection');
const { Schema } = require('mongoose');

const memberSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            match: [/.+@.+\..+/, 'Must be a valid email address'],
        },
        password: {
            type: String,
            required: true,
        },
        fullName: {
            type: String,
            required: true,
        },
        its: {
            type: String,
            required: true,
        },
        hofIts: {
            type: String,
            required: true,
        },
        roles: [{ type: String }],
    },
    {
        toJSON: { virtuals: true },
    }
);

memberSchema.pre('save', async function (next) {
    if (this.isNew || this.isModified('password')) {
        const saltRounds = 10;
        this.password = await bcrypt.hash(this.password, saltRounds);
    }
    next();
});

memberSchema.methods.isCorrectPassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

const Member = fmbDb.model('Member', memberSchema);

module.exports = Member;
