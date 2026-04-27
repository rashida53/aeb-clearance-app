import { gql } from '@apollo/client';

export const GET_MY_QB_OPENS = gql`
    query getMyQbOpens($userId: ID!) {
        getMyQbOpens(userId: $userId) {
            _id
            qb_id
            amount
            balance
        }
    }
`;

export const GET_MY_OPEN_BALANCES = gql`
    query getMyOpenBalances($hofIts: String!) {
        getMyOpenBalances(hofIts: $hofIts) {
            _id
            qb_id
            amount
            balance
            customer
            due
            pp
        }
    }
`;

export const GET_APPROVAL_STATUS = gql`
    query getApprovalStatus($hofIts: String!, $userId: ID!) {
        getApprovalStatus(hofIts: $hofIts, userId: $userId) {
            approved
            remarks
            approverName
        }
    }
`;
