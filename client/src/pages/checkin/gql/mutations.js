import { gql } from '@apollo/client';

export const UPSERT_COMMITMENT_FOR_USER = gql`
    mutation upsertCommitmentForUser($userId: ID!, $kr: Float, $ut: Float, $year: String!) {
        upsertCommitmentForUser(userId: $userId, kr: $kr, ut: $ut, year: $year) {
            _id
            kr
            ut
        }
    }
`;

export const UPSERT_ACH_FOR_USER = gql`
    mutation upsertACHForUser($userId: ID!, $accountNumber: String!, $routingNumber: String!) {
        upsertACHForUser(userId: $userId, accountNumber: $accountNumber, routingNumber: $routingNumber)
    }
`;

export const UPSERT_HUQOOQ = gql`
    mutation upsertHuqooq($userId: ID!, $year: String!, $wajebaatAmount: Float, $sfAmount: Float, $wcheck: Boolean, $sfcheck: Boolean) {
        upsertHuqooq(userId: $userId, year: $year, wajebaatAmount: $wajebaatAmount, sfAmount: $sfAmount, wcheck: $wcheck, sfcheck: $sfcheck) {
            _id
            wajebaatAmount
            sfAmount
            wcheck
            sfcheck
        }
    }
`;
