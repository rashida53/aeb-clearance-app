import { gql } from '@apollo/client';

export const GET_ALL_ACTIVE_USERS = gql`
    query getAllActiveUsers {
        getAllActiveUsers {
            _id
            fullName
            hofIts
            zone
        }
    }
`;

export const GET_CHECK_IN_DATA = gql`
    query getCheckInData($userId: ID!, $year: String!) {
        getCheckInData(userId: $userId, year: $year) {
            user {
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
            lastYearKr
            lastYearUt
            ach {
                _id
                accountNumber
                routingNumber
                check
                signature
            }
            openPledges {
                _id
                qb_id
                amount
                balance
                due
                customer
            }
            fmbPledgeAmount
            fmbPledgeStatus
            takhmeen {
                _id
                wajebaat
                sf
                wcheck
                sfcheck
                ha
                na
                reason
            }
            masjid {
                t1
                t2
                adaa
            }
        }
    }
`;
