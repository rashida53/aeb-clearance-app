import { gql } from '@apollo/client';

export const SUBMIT_COMMITMENTS = gql`
    mutation submitCommitments($kr: Float, $ut: Float, $year: String!) {
        submitCommitments(kr: $kr, ut: $ut, year: $year) {
            _id
            kr
            ut
        }
    }
`;

export const SUBMIT_ACH = gql`
    mutation submitACH($accountNumber: String!, $routingNumber: String!, $schedule: String!) {
        submitACH(accountNumber: $accountNumber, routingNumber: $routingNumber, schedule: $schedule)
    }
`;

export const DEFER_ACH = gql`
    mutation deferACH {
        deferACH
    }
`;

export const EMAIL_APPOINTMENT = gql`
    mutation emailAppointment($emails: String!) {
        emailAppointment(emails: $emails)
    }
`;

export const BOOK_SLOT = gql`
    mutation bookSlot($slotId: ID!) {
        bookSlot(slotId: $slotId) {
            _id
            date
            startTime
            endTime
        }
    }
`;

export const CANCEL_MY_SLOT = gql`
    mutation cancelMySlot {
        cancelMySlot {
            _id
        }
    }
`;
