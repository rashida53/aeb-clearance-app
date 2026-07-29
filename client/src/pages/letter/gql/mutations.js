import { gql } from '@apollo/client';

export const GENERATE_LETTER = gql`
    mutation generateLetter(
        $hofIts: String!
        $hofName: String!
        $reason: String!
        $description: String!
        $laagatAmount: Float
        $sarkaariLaagat: Float
        $jamaatLaagat: Float
    ) {
        generateLetter(
            hofIts: $hofIts
            hofName: $hofName
            reason: $reason
            description: $description
            laagatAmount: $laagatAmount
            sarkaariLaagat: $sarkaariLaagat
            jamaatLaagat: $jamaatLaagat
        )
    }
`;
