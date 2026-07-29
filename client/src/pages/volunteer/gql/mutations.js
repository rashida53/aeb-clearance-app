import { gql } from '@apollo/client';

export const CLAIM_SLOT_GROUP = gql`
    mutation claimSlotGroup($date: String!, $group: String!) {
        claimSlotGroup(date: $date, group: $group)
    }
`;

export const UNCLAIM_SLOT_GROUP = gql`
    mutation unclaimSlotGroup($date: String!, $group: String!) {
        unclaimSlotGroup(date: $date, group: $group)
    }
`;
