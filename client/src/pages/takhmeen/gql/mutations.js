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
