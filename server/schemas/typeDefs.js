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
    masjid: String!
    approvedAt: Float!
}

type ApprovalStatus {
    approved: Boolean!
    remarks: String
    approverName: String
}

type Slot {
    _id: ID
    date: String
    startTime: String
    endTime: String
    bookedBy: ActiveUser
}

type Commitment {
    _id: ID
    user: ActiveUser
    year: String
    kr: Float
    ut: Float
    schedule: String
}

type ACHInfo {
    _id: ID
    user: ActiveUser
    accountNumber: String
    routingNumber: String
}

type SlotWithDetails {
    _id: ID
    date: String
    startTime: String
    endTime: String
    bookedBy: ActiveUser
    commitment: Commitment
    openPledges: [QBOpen]
}

type HOFSlotStatus {
    user: ActiveUser
    slot: Slot
}

type Miqaat {
    _id: ID
    title: String
    date: String
    hijriDate: String
}

type MyWajebaatStatus {
    commitment: Commitment
    lastYearCommitment: Commitment
    ach: ACHInfo
    bookedSlot: Slot
    hostingMiqaats: [Miqaat]
    fmbPledgeAmount: Float
}

type Query {
    me: LoggedInUser
    getMyOpenBalances(hofIts: String!): [QBOpen]
    getMyQbOpens(userId: ID!): [QBOpen]
    getAllActiveUsers: [ActiveUser]
    getApprovalStatus(hofIts: String!, userId: ID!): ApprovalStatus
    getApprovalsByRequester(userId: ID!): [Approval]
    getSlots: [Slot]
    getSlotsByDate(date: String!): [SlotWithDetails]
    getHOFSlotStatuses: [HOFSlotStatus]
    lookupACH(userId: ID!): ACHInfo
    getMyWajebaatStatus: MyWajebaatStatus
    getAvailableSlots: [Slot]
}

type Mutation {
    login(email: String!, password: String!): Auth
    addMember(email: String!, password: String!, fullName: String!, its: String!, hofIts: String!): Auth
    resetPassword(password: String!, its: String!, hofIts: String!): Member
    generateLetter(hofIts: String!, hofName: String!, reason: String!, description: String!): Boolean
    createApproval(hofIts: String!, requester: String!, remarks: String!, masjid: String!): Approval
    createSlots(startDate: String!, endDate: String!, startTime: String!, endTime: String!, duration: Int!): [Slot]
    deleteSlot(slotId: ID!): Boolean
    cancelSignup(slotId: ID!): Slot
    submitCommitments(kr: Float, ut: Float, year: String!): Commitment
    submitACH(accountNumber: String!, routingNumber: String!, schedule: String!): Boolean
    bookSlot(slotId: ID!): Slot
    cancelMySlot: Slot
}
`;

module.exports = typeDefs;
