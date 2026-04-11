import { gql } from '@apollo/client';

export const GENERATE_LETTER = gql`
    mutation generateLetter(
        $hofIts: String!
        $hofName: String!
        $reason: String!
        $description: String!
    ) {
        generateLetter(
            hofIts: $hofIts
            hofName: $hofName
            reason: $reason
            description: $description
        )
    }
`;
