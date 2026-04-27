const { clearanceDb } = require('../config/connection');
const { Schema } = require('mongoose');

const approvalSchema = new Schema(
    {
        hofIts: {
            type: String,
            required: true,
        },
        requester: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        approver: {
            type: String,
            required: true,
        },
        remarks: {
            type: String,
            required: true,
        },
        approvedAt: {
            type: Number,
            required: true,
        },
    },
    {
        collection: 'approvals',
    }
);

const Approval = clearanceDb.model('Approval', approvalSchema);

module.exports = Approval;
