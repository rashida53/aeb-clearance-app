import { gql } from '@apollo/client';

export const CREATE_APPROVAL = gql`
    mutation createApproval(
        $hofIts: String!
        $requester: String!
        $remarks: String!
    ) {
        createApproval(
            hofIts: $hofIts
            requester: $requester
            remarks: $remarks
        ) {
            _id
            approvedAt
        }
    }
`;
