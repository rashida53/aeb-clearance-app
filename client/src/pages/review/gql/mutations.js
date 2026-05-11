import { gql } from '@apollo/client';

export const CREATE_APPROVAL = gql`
    mutation createApproval(
        $hofIts: String!
        $requester: String!
        $remarks: String!
        $masjid: String!
    ) {
        createApproval(
            hofIts: $hofIts
            requester: $requester
            remarks: $remarks
            masjid: $masjid
        ) {
            _id
            approvedAt
        }
    }
`;
