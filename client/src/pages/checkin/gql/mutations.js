import { gql } from '@apollo/client';

export const UPSERT_COMMITMENT_FOR_USER = gql`
    mutation upsertCommitmentForUser($userId: ID!, $kr: Float, $ut: Float, $year: String!, $schedule: String) {
        upsertCommitmentForUser(userId: $userId, kr: $kr, ut: $ut, year: $year, schedule: $schedule) {
            _id
            kr
            ut
            schedule
        }
    }
`;

export const UPSERT_ACH_FOR_USER = gql`
    mutation upsertACHForUser($userId: ID!, $accountNumber: String, $routingNumber: String, $check: String, $signature: String) {
        upsertACHForUser(userId: $userId, accountNumber: $accountNumber, routingNumber: $routingNumber, check: $check, signature: $signature)
    }
`;

export const UPSERT_TAKHMEEN = gql`
    mutation upsertTakhmeen($userId: ID!, $year: String!, $wcheck: String, $sfcheck: String) {
        upsertTakhmeen(userId: $userId, year: $year, wcheck: $wcheck, sfcheck: $sfcheck) {
            _id
            wcheck
            sfcheck
        }
    }
`;
