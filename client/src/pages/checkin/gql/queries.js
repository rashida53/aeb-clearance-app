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
            ach {
                _id
                accountNumber
                routingNumber
            }
            openPledges {
                _id
                qb_id
                amount
                balance
                due
                customer
            }
            huqooq {
                _id
                wajebaatAmount
                sfAmount
                wcheck
                sfcheck
            }
            fmbPledgeAmount
            takhmeen {
                _id
                wajebaat
                sf
            }
        }
    }
`;
