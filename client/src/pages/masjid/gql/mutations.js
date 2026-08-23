import { gql } from '@apollo/client';

export const UPSERT_MASJID_NIYYAT = gql`
    mutation upsertMasjidNiyyat($userId: ID!, $t1: Float!, $t2: Float!) {
        upsertMasjidNiyyat(userId: $userId, t1: $t1, t2: $t2)
    }
`;
