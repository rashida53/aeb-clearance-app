import { gql } from '@apollo/client';

export const UPSERT_TAKHMEEN = gql`
    mutation upsertTakhmeen($userId: ID!, $year: String!, $wajebaat: Float, $sf: Float, $ha: Boolean, $na: Boolean, $reason: String) {
        upsertTakhmeen(userId: $userId, year: $year, wajebaat: $wajebaat, sf: $sf, ha: $ha, na: $na, reason: $reason) {
            _id
            wajebaat
            sf
            ha
            na
            reason
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
