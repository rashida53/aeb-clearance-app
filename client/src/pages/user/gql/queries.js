import { gql } from '@apollo/client';

export const GET_ME = gql`
    query me {
        me {
            userId
            userFullName
            userZone
            memberId
            memberFullName
            memberEmail
            memberIts
            memberHof
            roles
        }
    }
`;
