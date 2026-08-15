import { gql } from '@apollo/client';

export const GET_SLOTS = gql`
    query getSlots {
        getSlots {
            _id
            date
            startTime
            endTime
            bookedBy {
                _id
                fullName
                hofIts
            }
        }
    }
`;

export const GET_SLOTS_BY_DATE = gql`
    query getSlotsByDate($date: String!) {
        getSlotsByDate(date: $date) {
            _id
            date
            startTime
            endTime
            bookedBy {
                _id
                fullName
                hofIts
            }
            commitment {
                _id
                kr
                ut
                schedule
            }
            openPledges {
                _id
                amount
                balance
                due
                pp
            }
        }
    }
`;

export const GET_HOF_SLOT_STATUSES = gql`
    query getHOFSlotStatuses {
        getHOFSlotStatuses {
            user {
                _id
                fullName
                hofIts
                zone
            }
            slot {
                _id
                date
                startTime
                endTime
            }
        }
    }
`;

export const LOOKUP_ACH = gql`
    query lookupACH($userId: ID!) {
        lookupACH(userId: $userId) {
            _id
            user {
                _id
                fullName
                hofIts
            }
            accountNumber
            routingNumber
        }
    }
`;

export const GET_HUQOOQ_EXPORT = gql`
    query getHuqooqExport {
        getHuqooqExport {
            its
            previousYear
            name
            wajebaatAmount
            wcheck
            sfAmount
            sfcheck
        }
    }
`;

export const GET_MAALIYA_VOLUNTEERS = gql`
    query getMaaliyaVolunteers {
        getMaaliyaVolunteers {
            _id
            fullName
        }
    }
`;
