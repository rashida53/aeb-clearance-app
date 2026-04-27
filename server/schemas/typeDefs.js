const { gql } = require('apollo-server-express');

const typeDefs = gql`

type Auth {
    token: ID!
    me: LoggedInUser
}

type LoggedInUser {
    userId: ID
    userFullName: String!
    userZone: String!
    memberId: ID
    memberFullName: String!
    memberEmail: String!
    memberIts: String!
    memberHof: String!
    roles: [String]
}

type Member {
    _id: ID
    fullName: String!
    email: String!
    its: String!
    hofIts: String!
    roles: [String]
}

type QBOpen {
    _id: ID
    hofIts: String
    qb_id: String
    amount: Float
    balance: Float
    due: String
    customer: String
    pp: String
}

type ActiveUser {
    _id: ID
    fullName: String!
    hofIts: String!
    zone: String
}

type Approval {
    _id: ID
    hofIts: String!
    requester: String!
    approver: String!
    remarks: String!
    approvedAt: Float!
}

type ApprovalStatus {
    approved: Boolean!
    remarks: String
    approverName: String
}

type Query {
    me: LoggedInUser
    getMyOpenBalances(hofIts: String!): [QBOpen]
    getMyQbOpens(userId: ID!): [QBOpen]
    getAllActiveUsers: [ActiveUser]
    getApprovalStatus(hofIts: String!, userId: ID!): ApprovalStatus
}

type Mutation {
    login(email: String!, password: String!): Auth
    addMember(email: String!, password: String!, fullName: String!, its: String!, hofIts: String!): Auth
    resetPassword(password: String!, its: String!, hofIts: String!): Member
    generateLetter(hofIts: String!, hofName: String!, reason: String!, description: String!): Boolean
    createApproval(hofIts: String!, requester: String!, remarks: String!): Approval
}
`;

module.exports = typeDefs;
