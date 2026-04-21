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
