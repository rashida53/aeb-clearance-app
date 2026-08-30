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
    group: String
    volunteer: ActiveUser
}

type SlotGroup {
    date: String
    group: String
    slotCount: Int
    volunteer: ActiveUser
    bookedUsers: [ActiveUser]
}

type Commitment {
    _id: ID
    user: ActiveUser
    year: String
    kr: Float
    ut: Float
    schedule: String
    ach: ID
}

type ACHInfo {
    _id: ID
    user: ActiveUser
    accountNumber: String
    routingNumber: String
    authorized: Boolean
    check: String
    signature: String
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

type Takhmeen {
    _id: ID
    user: ActiveUser
    year: String
    wajebaat: Float
    sf: Float
    wcheck: String
    sfcheck: String
}

type CheckInData {
    user: ActiveUser
    commitment: Commitment
    lastYearKr: Float
    lastYearUt: Float
    ach: ACHInfo
    openPledges: [QBOpen]
    fmbPledgeAmount: Float
    fmbPledgeStatus: String
    takhmeen: Takhmeen
}

type FmbPledgeInfo {
    amount: Float
    status: String
}

type MasjidNiyyat {
    t1: Float
    t2: Float
    adaa: Float
}

type MasjidDashboardRow {
    user: ActiveUser
    t1: Float
    t2: Float
    adaa: Float
    progress: Float
    pending: Boolean
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
    getAllACH: [ACHInfo]
    getMyWajebaatStatus: MyWajebaatStatus
    getAvailableSlots: [Slot]
    getVolunteerSlotGroups: [SlotGroup]
    getMaaliyaVolunteers: [ActiveUser]
    getCheckInData(userId: ID!, year: String!): CheckInData
    getTakhmeen(userId: ID!, year: String!): Takhmeen
    getCommitmentForUser(userId: ID!, year: String!): Commitment
    getFmbPledge(userId: ID!, year: String!): FmbPledgeInfo
    getHuqooqExport: [HuqooqExportRow]
    getMyMasjidNiyyat: MasjidNiyyat
    getMasjidDashboard: [MasjidDashboardRow]
    getMasjidNiyyatForUser(userId: ID!): MasjidNiyyat
}

type HuqooqExportRow {
    its: String
    previousYear: Float
    name: String
    wajebaatAmount: Float
    wcheck: String
    sfAmount: Float
    sfcheck: String
}

type Mutation {
    login(email: String!, password: String!): Auth
    addMember(email: String!, password: String!, fullName: String!, its: String!, hofIts: String!): Auth
    resetPassword(password: String!, its: String!, hofIts: String!): Member
    generateLetter(hofIts: String!, hofName: String!, reason: String!, description: String!, laagatAmount: Float, sarkaariLaagat: Float, jamaatLaagat: Float): Boolean
    createApproval(hofIts: String!, requester: String!, remarks: String!, masjid: String!): Approval
    createSlots(startDate: String!, endDate: String!, startTime: String!, endTime: String!, duration: Int!): [Slot]
    deleteSlot(slotId: ID!): Boolean
    cancelSignup(slotId: ID!): Slot
    submitCommitments(kr: Float, ut: Float, year: String!): Commitment
    submitACH(accountNumber: String!, routingNumber: String!, schedule: String!, authorized: Boolean, check: String, signature: String): Boolean
    deferACH: Boolean
    emailAppointment(emails: String!): Boolean
    bookSlot(slotId: ID!): Slot
    cancelMySlot: Slot
    claimSlotGroup(date: String!, group: String!): Boolean
    unclaimSlotGroup(date: String!, group: String!): Boolean
    reassignSlotGroup(date: String!, group: String!, volunteerId: ID!): Boolean
    upsertCommitmentForUser(userId: ID!, kr: Float, ut: Float, year: String!, schedule: String): Commitment
    upsertACHForUser(userId: ID!, accountNumber: String, routingNumber: String, check: String, signature: String): Boolean
    upsertTakhmeen(userId: ID!, year: String!, wajebaat: Float, sf: Float, wcheck: String, sfcheck: String): Takhmeen
    upsertMasjidNiyyat(userId: ID!, t1: Float!, t2: Float!): Boolean
    deleteACH(achId: ID!): Boolean
}
`;

module.exports = typeDefs;
