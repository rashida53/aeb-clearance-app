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
