import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_SLOTS_BY_DATE } from '../admin/gql/queries';

const formatTime12 = (time24) => {
    if (!time24) return '—';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const formatCurrency = (amount) =>
    amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount) : '—';

const SCHEDULE_LABELS = {
    ONE_TIME: '1 time',
    THREE_MONTH: '3 month',
    SIX_MONTH: '6 month',
    NINE_MONTH: '9 month',
};

export default function Checkin() {
    const [selectedDate, setSelectedDate] = useState('');
    const { data, loading } = useQuery(GET_SLOTS_BY_DATE, {
        variables: { date: selectedDate },
        skip: !selectedDate,
    });

    const slots = data?.getSlotsByDate || [];

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="adminHeader">
                    <h1>Check-In</h1>
                </div>

                <div className="adminSection">
                    <div className="adminFormGroup">
                        <label>Select Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min="2027-02-07"
                            max="2027-03-05"
                        />
                    </div>

                    {selectedDate && loading && <p>Loading...</p>}

                    {selectedDate && !loading && slots.length === 0 && (
                        <p className="adminEmpty">No slots for this date.</p>
                    )}

                    {selectedDate && !loading && slots.length > 0 && (
                        <div className="adminTableWrapper">
                            <table className="adminTable">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Booked By</th>
                                        <th>KR</th>
                                        <th>UT</th>
                                        <th>Schedule</th>
                                        <th>Open Pledges</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slots.map((slot) => (
                                        <tr key={slot._id} className={!slot.bookedBy ? 'adminRowAvailable' : ''}>
                                            <td>{formatTime12(slot.startTime)}</td>
                                            <td>{slot.bookedBy ? slot.bookedBy.fullName : 'Available'}</td>
                                            <td>{slot.commitment ? formatCurrency(slot.commitment.kr) : '—'}</td>
                                            <td>{slot.commitment ? formatCurrency(slot.commitment.ut) : '—'}</td>
                                            <td>
                                                {slot.commitment
                                                    ? SCHEDULE_LABELS[slot.commitment.schedule] || slot.commitment.schedule
                                                    : '—'}
                                            </td>
                                            <td>
                                                {slot.openPledges && slot.openPledges.length > 0
                                                    ? `${slot.openPledges.length} (${formatCurrency(
                                                          slot.openPledges.reduce((sum, p) => sum + (p.balance || 0), 0)
                                                      )})`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
