import { gql } from '@apollo/client';

export const LOGIN_USER = gql`
    mutation login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
            token
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
    }
`;

export const ADD_MEMBER = gql`
    mutation addMember($fullName: String!, $email: String!, $password: String!, $its: String!, $hofIts: String!) {
        addMember(fullName: $fullName, email: $email, password: $password, its: $its, hofIts: $hofIts) {
            token
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
    }
`;

export const RESET_PASSWORD = gql`
    mutation resetPassword($its: String!, $hofIts: String!, $password: String!) {
        resetPassword(its: $its, hofIts: $hofIts, password: $password) {
            its
            hofIts
        }
    }
`;
