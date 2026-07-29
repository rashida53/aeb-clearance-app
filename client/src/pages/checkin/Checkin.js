import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ALL_ACTIVE_USERS, GET_CHECK_IN_DATA } from './gql/queries';
import { UPSERT_COMMITMENT_FOR_USER, UPSERT_ACH_FOR_USER, UPSERT_HUQOOQ } from './gql/mutations';

const CURRENT_YEAR = '1448-49';

const formatCurrency = (amount) =>
    amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount) : '—';

export default function Checkin() {
    const { data: usersData } = useQuery(GET_ALL_ACTIVE_USERS);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    const [getCheckInData, { data: checkInData, loading: checkInLoading }] = useLazyQuery(GET_CHECK_IN_DATA, {
        fetchPolicy: 'network-only',
    });

    const [upsertCommitment] = useMutation(UPSERT_COMMITMENT_FOR_USER);
    const [upsertACH] = useMutation(UPSERT_ACH_FOR_USER);
    const [upsertHuqooq] = useMutation(UPSERT_HUQOOQ);

    const [kr, setKr] = useState('');
    const [ut, setUt] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [routingNumber, setRoutingNumber] = useState('');
    const [wajebaatAmount, setWajebaatAmount] = useState('');
    const [sfAmount, setSfAmount] = useState('');
    const [wcheck, setWcheck] = useState(false);
    const [sfcheck, setSfcheck] = useState(false);
    const [saving, setSaving] = useState('');
    const [error, setError] = useState('');

    const allUsers = usersData?.getAllActiveUsers || [];
    const filtered = searchTerm.length >= 2
        ? allUsers.filter((u) =>
            u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10)
        : [];

    const ciData = checkInData?.getCheckInData;

    useEffect(() => {
        if (!ciData) return;
        setKr(ciData.commitment?.kr != null ? String(ciData.commitment.kr) : '');
        setUt(ciData.commitment?.ut != null ? String(ciData.commitment.ut) : '');
        setAccountNumber(ciData.ach?.accountNumber || '');
        setRoutingNumber(ciData.ach?.routingNumber || '');
        setWajebaatAmount(ciData.huqooq?.wajebaatAmount != null ? String(ciData.huqooq.wajebaatAmount) : '');
        setSfAmount(ciData.huqooq?.sfAmount != null ? String(ciData.huqooq.sfAmount) : '');
        setWcheck(ciData.huqooq?.wcheck || false);
        setSfcheck(ciData.huqooq?.sfcheck || false);
    }, [ciData]);

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSearchTerm('');
        setError('');
        getCheckInData({ variables: { userId: user._id, year: CURRENT_YEAR } });
    };

    const handleSaveAll = async () => {
        setSaving('all'); setError('');
        try {
            const promises = [];
            promises.push(upsertCommitment({
                variables: { userId: selectedUser._id, kr: parseFloat(kr) || 0, ut: parseFloat(ut) || 0, year: CURRENT_YEAR },
            }));
            if (accountNumber && routingNumber) {
                promises.push(upsertACH({
                    variables: { userId: selectedUser._id, accountNumber, routingNumber },
                }));
            }
            promises.push(upsertHuqooq({
                variables: {
                    userId: selectedUser._id,
                    year: CURRENT_YEAR,
                    wajebaatAmount: parseFloat(wajebaatAmount) || null,
                    sfAmount: parseFloat(sfAmount) || null,
                    wcheck,
                    sfcheck,
                },
            }));
            await Promise.all(promises);
            setSaving('');
        } catch (err) { setError(err.message); setSaving(''); }
    };

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="ciHeader">
                    <h1>Check-In</h1>
                </div>

                {error && <p className="ciError">{error}</p>}

                <div className="ciSearch">
                    <input
                        className="ciSearchInput"
                        type="text"
                        placeholder="HOF Name"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {filtered.length > 0 && (
                        <div className="ciSearchResults">
                            {filtered.map((u) => (
                                <div key={u._id} className="ciSearchItem" onClick={() => handleSelectUser(u)}>
                                    <span className="ciSearchName">{u.fullName}</span>
                                    <span className="ciSearchIts">{u.hofIts}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedUser && (
                    <div className="ciForm">
                        <div className="ciUserBar">
                            <h3 className="ciUserName">{selectedUser.fullName}</h3>
                            <p className="ciUserDetail">ITS: {selectedUser.hofIts}</p>
                            <p className="ciUserDetail">Mohalla: {selectedUser.zone}</p>
                        </div>

                        {checkInLoading ? (
                            <p>Loading...</p>
                        ) : (
                            <>
                                <div className="ciSection">
                                    <h3 className="ciSectionTitle">Huqooq</h3>
                                    <div className="ciFieldRow">
                                        <div className="ciFieldGroup">
                                            <label className="ciLabel">Waajebaat Check Amount</label>
                                            <input
                                                className="ciInput"
                                                type="number"
                                                placeholder="Amount"
                                                value={wajebaatAmount}
                                                onChange={(e) => setWajebaatAmount(e.target.value)}
                                            />
                                        </div>
                                        <div className="ciCheckRow">
                                            <label className="ciCheckLabel">
                                                <input
                                                    type="checkbox"
                                                    checked={wcheck}
                                                    onChange={(e) => setWcheck(e.target.checked)}
                                                />
                                                Check Submitted
                                            </label>
                                        </div>
                                    </div>
                                    <div className="ciFieldRow">
                                        <div className="ciFieldGroup">
                                            <label className="ciLabel">Sila Fitra Amount</label>
                                            <input
                                                className="ciInput"
                                                type="number"
                                                placeholder="Amount"
                                                value={sfAmount}
                                                onChange={(e) => setSfAmount(e.target.value)}
                                            />
                                        </div>
                                        <div className="ciCheckRow">
                                            <label className="ciCheckLabel">
                                                <input
                                                    type="checkbox"
                                                    checked={sfcheck}
                                                    onChange={(e) => setSfcheck(e.target.checked)}
                                                />
                                                Check Submitted
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="ciSection">
                                    <h3 className="ciSectionTitle">ACH Details</h3>
                                    <div className="ciFieldRow">
                                        <div className="ciFieldGroup">
                                            <label className="ciLabel">Account Number</label>
                                            <input
                                                className="ciInput"
                                                type="text"
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                            />
                                        </div>
                                        <div className="ciFieldGroup">
                                            <label className="ciLabel">Routing Number</label>
                                            <input
                                                className="ciInput"
                                                type="text"
                                                value={routingNumber}
                                                onChange={(e) => setRoutingNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="ciSection">
                                    <h3 className="ciSectionTitle">Austin Khidmat</h3>
                                    <div className="ciInlineRow">
                                        <label className="ciInlineLabel">Khidmat Ramadaniyah</label>
                                        <input
                                            className="ciInlineInput"
                                            type="number"
                                            placeholder="Amount"
                                            value={kr}
                                            onChange={(e) => setKr(e.target.value)}
                                        />
                                    </div>
                                    <div className="ciInlineRow">
                                        <label className="ciInlineLabel">Umoor Taalimiyah</label>
                                        <input
                                            className="ciInlineInput"
                                            type="number"
                                            placeholder="Amount"
                                            value={ut}
                                            onChange={(e) => setUt(e.target.value)}
                                        />
                                    </div>
                                    <div className="ciInlineRow">
                                        <label className="ciInlineLabel">Faiz ul Mawaid il Burhaniyah</label>
                                        <span className="ciInlineValue">
                                            {ciData?.fmbPledgeAmount != null ? formatCurrency(ciData.fmbPledgeAmount) : 'PENDING'}
                                        </span>
                                    </div>
                                </div>

                                <div className="ciSection">
                                    <h3 className="ciSectionTitle">Open Pledges</h3>
                                    {ciData?.openPledges && ciData.openPledges.length > 0 ? (
                                        <ul className="ciPledgeList">
                                            {ciData.openPledges.map((p) => (
                                                <li key={p._id} className="ciPledgeItem">
                                                    <span>{p.qb_id}</span>
                                                    <span>{formatCurrency(p.amount)}</span>
                                                    {p.pp && <span className="ciPledgePP">PP</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="ciNoData">No open pledges</p>
                                    )}
                                </div>

                                <div className="ciSaveRow">
                                    <button
                                        className="ciBtnSave"
                                        onClick={handleSaveAll}
                                        disabled={saving === 'all'}
                                    >
                                        {saving === 'all' ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
