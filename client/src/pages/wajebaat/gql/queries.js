import { gql } from '@apollo/client';

export const GET_MY_WAJEBAAT_STATUS = gql`
    query getMyWajebaatStatus {
        getMyWajebaatStatus {
            commitment {
                _id
                kr
                ut
                schedule
            }
            lastYearCommitment {
                _id
                kr
                ut
            }
            ach {
                _id
                accountNumber
                routingNumber
                authorized
                check
                signature
            }
            bookedSlot {
                _id
                date
                startTime
                endTime
            }
            hostingMiqaats {
                _id
                title
                date
                hijriDate
            }
            fmbPledgeAmount
        }
    }
`;

export const GET_AVAILABLE_SLOTS = gql`
    query getAvailableSlots {
        getAvailableSlots {
            _id
            date
            startTime
            endTime
            group
        }
    }
`;
