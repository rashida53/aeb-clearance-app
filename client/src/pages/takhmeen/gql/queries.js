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

export const GET_TAKHMEEN = gql`
    query getTakhmeen($userId: ID!, $year: String!) {
        getTakhmeen(userId: $userId, year: $year) {
            _id
            wajebaat
            sf
        }
    }
`;
