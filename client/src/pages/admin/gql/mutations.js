import { gql } from '@apollo/client';

export const CREATE_SLOTS = gql`
    mutation createSlots($startDate: String!, $endDate: String!, $startTime: String!, $endTime: String!, $duration: Int!) {
        createSlots(startDate: $startDate, endDate: $endDate, startTime: $startTime, endTime: $endTime, duration: $duration) {
            _id
            date
            startTime
            endTime
        }
    }
`;

export const DELETE_SLOT = gql`
    mutation deleteSlot($slotId: ID!) {
        deleteSlot(slotId: $slotId)
    }
`;

export const CANCEL_SIGNUP = gql`
    mutation cancelSignup($slotId: ID!) {
        cancelSignup(slotId: $slotId) {
            _id
            date
            startTime
            endTime
            bookedBy {
                _id
                fullName
            }
        }
    }
`;

export const REASSIGN_SLOT_GROUP = gql`
    mutation reassignSlotGroup($date: String!, $group: String!, $volunteerId: ID!) {
        reassignSlotGroup(date: $date, group: $group, volunteerId: $volunteerId)
    }
`;
