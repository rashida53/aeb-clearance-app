import { gql } from '@apollo/client';

export const GET_VOLUNTEER_SLOT_GROUPS = gql`
    query getVolunteerSlotGroups {
        getVolunteerSlotGroups {
            date
            group
            slotCount
            volunteer {
                _id
                fullName
            }
            bookedUsers {
                _id
                fullName
            }
        }
    }
`;
