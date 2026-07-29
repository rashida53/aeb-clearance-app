import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ME } from '../user/gql/queries';
import { GET_VOLUNTEER_SLOT_GROUPS } from './gql/queries';
import { CLAIM_SLOT_GROUP, UNCLAIM_SLOT_GROUP } from './gql/mutations';

const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const GROUP_ORDER = ['After Zohr Asr', 'Before Maghrib Isha', 'After Maghrib Isha'];

export default function Volunteer() {
    const { data: meData } = useQuery(GET_ME);
    const { data, loading, refetch } = useQuery(GET_VOLUNTEER_SLOT_GROUPS);
    const [claimSlotGroup] = useMutation(CLAIM_SLOT_GROUP);
    const [unclaimSlotGroup] = useMutation(UNCLAIM_SLOT_GROUP);
    const [error, setError] = useState('');

    const myUserId = meData?.me?.userId;
    const groups = data?.getVolunteerSlotGroups || [];

    const availableGroups = groups.filter((g) => !g.volunteer);
    const myGroups = groups.filter((g) => g.volunteer?._id === myUserId);

    const availableByDate = {};
    availableGroups.forEach((g) => {
        if (!availableByDate[g.date]) availableByDate[g.date] = [];
        availableByDate[g.date].push(g);
    });
    const availableDateKeys = Object.keys(availableByDate).sort();

    const myByDate = {};
    myGroups.forEach((g) => {
        if (!myByDate[g.date]) myByDate[g.date] = [];
        myByDate[g.date].push(g);
    });
    const myDateKeys = Object.keys(myByDate).sort();

    const handleClaim = async (date, group) => {
        setError('');
        try {
            await claimSlotGroup({ variables: { date, group } });
            refetch();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleUnclaim = async (date, group) => {
        setError('');
        try {
            await unclaimSlotGroup({ variables: { date, group } });
            refetch();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <>
                <Nav />
                <div className="pageContainer"><p>Loading...</p></div>
            </>
        );
    }

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="volHeader">
                    <h1>Volunteer</h1>
                </div>

                {error && <p className="volError">{error}</p>}

                {availableDateKeys.length === 0 ? (
                    <p className="volEmpty">No slot groups available.</p>
                ) : (
                    <div className="volDates">
                        {availableDateKeys.map((dateKey) => {
                            const dateGroups = availableByDate[dateKey].sort(
                                (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
                            );
                            return (
                                <div key={dateKey} className="volDateSection">
                                    <h2 className="volDateTitle">{formatDate(dateKey)}</h2>
                                    <div className="volGroupCards">
                                        {dateGroups.map((g) => (
                                            <div key={`${g.date}-${g.group}`} className="volGroupCard">
                                                <div className="volGroupName">{g.group}</div>
                                                {g.bookedUsers && g.bookedUsers.length > 0 ? (
                                                    <ul className="volGroupBookedList">
                                                        {g.bookedUsers.map((u) => (
                                                            <li key={u._id}>{u.fullName}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <div className="volGroupNoSignups">No signups yet</div>
                                                )}
                                                <div className="volGroupAction">
                                                    <button
                                                        className="volBtnClaim"
                                                        onClick={() => handleClaim(g.date, g.group)}
                                                    >
                                                        Volunteer
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {myDateKeys.length > 0 && (
                    <>
                        <h2 className="volSectionTitle">My Volunteer Slots</h2>
                        <div className="volDates">
                            {myDateKeys.map((dateKey) => {
                                const dateGroups = myByDate[dateKey].sort(
                                    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
                                );
                                return (
                                    <div key={dateKey} className="volDateSection">
                                        <h2 className="volDateTitle">{formatDate(dateKey)}</h2>
                                        <div className="volGroupCards">
                                            {dateGroups.map((g) => (
                                                <div key={`${g.date}-${g.group}`} className="volGroupCard mine">
                                                    <div className="volGroupName">{g.group}</div>
                                                    {g.bookedUsers && g.bookedUsers.length > 0 ? (
                                                        <ul className="volGroupBookedList">
                                                            {g.bookedUsers.map((u) => (
                                                                <li key={u._id}>{u.fullName}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <div className="volGroupNoSignups">No signups yet</div>
                                                    )}
                                                    <div className="volGroupAction">
                                                        <button
                                                            className="volBtnUnclaim"
                                                            onClick={() => handleUnclaim(g.date, g.group)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
