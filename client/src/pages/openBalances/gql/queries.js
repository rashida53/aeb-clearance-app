import { gql } from '@apollo/client';

export const GET_MY_OPEN_BALANCES = gql`
    query getMyOpenBalances($hofIts: String!) {
        getMyOpenBalances(hofIts: $hofIts) {
            _id
            qb_id
            balance
            customer
            due
        }
    }
`;
