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

export const GET_APPROVALS_BY_REQUESTER = gql`
    query getApprovalsByRequester($userId: ID!) {
        getApprovalsByRequester(userId: $userId) {
            _id
            remarks
            approvedAt
            approver
        }
    }
`;
