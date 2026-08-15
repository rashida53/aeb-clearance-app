import { gql } from '@apollo/client';

export const UPSERT_TAKHMEEN = gql`
    mutation upsertTakhmeen($userId: ID!, $year: String!, $wajebaat: Float, $sf: Float) {
        upsertTakhmeen(userId: $userId, year: $year, wajebaat: $wajebaat, sf: $sf) {
            _id
            wajebaat
            sf
        }
    }
`;

export const UPSERT_COMMITMENT_FOR_USER = gql`
    mutation upsertCommitmentForUser($userId: ID!, $kr: Float, $ut: Float, $year: String!, $schedule: String) {
        upsertCommitmentForUser(userId: $userId, kr: $kr, ut: $ut, year: $year, schedule: $schedule) {
            _id
            kr
            ut
        }
    }
`;
