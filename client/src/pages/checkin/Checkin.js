import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ALL_ACTIVE_USERS, GET_CHECK_IN_DATA } from './gql/queries';
import { UPSERT_COMMITMENT_FOR_USER, UPSERT_ACH_FOR_USER, UPSERT_TAKHMEEN } from './gql/mutations';
import CheckCapture from '../wajebaat/components/CheckCapture';
import SignaturePad from '../wajebaat/components/SignaturePad';

const CURRENT_YEAR = '1448-49';

const formatCurrency = (amount) =>
    amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount) : '—';

// Compact currency for large amounts: $53K (rounded up to the nearest thousand).
// Amounts of 0 show the full value so it doesn't render as "$0K".
const formatK = (amount) =>
    amount ? `$${Math.ceil(amount / 1000)}K` : formatCurrency(0);

// FMB pledge display: no pledge → PENDING; otherwise the amount, appending
// (PENDING) when the pledge itself is still pending.
const formatFmb = (amount, status) => {
    if (amount == null) return 'PENDING';
    const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    return status === 'PENDING' ? `${amt} (PENDING)` : amt;
};

export default function Checkin() {
    const { data: usersData } = useQuery(GET_ALL_ACTIVE_USERS);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    const [getCheckInData, { data: checkInData, loading: checkInLoading }] = useLazyQuery(GET_CHECK_IN_DATA, {
        fetchPolicy: 'network-only',
    });

    const [upsertCommitment] = useMutation(UPSERT_COMMITMENT_FOR_USER);
    const [upsertACH] = useMutation(UPSERT_ACH_FOR_USER);
    const [upsertTakhmeen] = useMutation(UPSERT_TAKHMEEN);

    const [kr, setKr] = useState('');
    const [ut, setUt] = useState('');
    const [schedule, setSchedule] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [routingNumber, setRoutingNumber] = useState('');
    const [check, setCheck] = useState(null);
    const [signature, setSignature] = useState(null);
    const [wcheck, setWcheck] = useState('');
    const [sfcheck, setSfcheck] = useState('');
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
        setSchedule(ciData.commitment?.schedule || '');
        setAccountNumber(ciData.ach?.accountNumber || '');
        setRoutingNumber(ciData.ach?.routingNumber || '');
        setCheck(ciData.ach?.check || null);
        setSignature(ciData.ach?.signature || null);
        setWcheck(ciData.takhmeen?.wcheck || '');
        setSfcheck(ciData.takhmeen?.sfcheck || '');
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
                variables: { userId: selectedUser._id, kr: parseFloat(kr) || 0, ut: parseFloat(ut) || 0, year: CURRENT_YEAR, schedule: schedule || null },
            }));
            if (accountNumber || routingNumber || check || signature) {
                promises.push(upsertACH({
                    variables: {
                        userId: selectedUser._id,
                        accountNumber: accountNumber || null,
                        routingNumber: routingNumber || null,
                        check: check || null,
                        signature: signature || null,
                    },
                }));
            }
            // No wajebaat check number is collected for Hazrat Aaliyah / No Niyyat.
            const isHaOrNa = ciData?.takhmeen?.ha || ciData?.takhmeen?.na;
            promises.push(upsertTakhmeen({
                variables: {
                    userId: selectedUser._id,
                    year: CURRENT_YEAR,
                    wcheck: isHaOrNa ? '' : wcheck,
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
                                            <label className="ciLabel">Wajebaat Amount</label>
                                            <div className="ciReadonly">
                                                {ciData?.takhmeen?.na
                                                    ? formatCurrency(0)
                                                    : ciData?.takhmeen?.wajebaat != null
                                                        ? formatCurrency(ciData.takhmeen.wajebaat)
                                                        : 'Pending'}
                                            </div>
                                        </div>
                                        <div className="ciFieldGroup">
                                            {!ciData?.takhmeen?.ha && !ciData?.takhmeen?.na && (
                                                <label className="ciLabel">Check Number</label>
                                            )}
                                            {ciData?.takhmeen?.ha ? (
                                                <div className="ciReadonly">Hazrat Aaliyah Adaa</div>
                                            ) : ciData?.takhmeen?.na ? (
                                                <div className="ciReadonly">{ciData.takhmeen.reason || '—'}</div>
                                            ) : (
                                                <input
                                                    className="ciInput"
                                                    type="text"
                                                    placeholder="Check #"
                                                    value={wcheck}
                                                    onChange={(e) => setWcheck(e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="ciFieldRow">
                                        <div className="ciFieldGroup">
                                            <label className="ciLabel">Sila Fitra Amount</label>
                                            <div className="ciReadonly">
                                                {ciData?.takhmeen?.sf != null
                                                    ? formatCurrency(ciData.takhmeen.sf)
                                                    : 'Pending'}
                                            </div>
                                        </div>
                                        <div className="ciFieldGroup">
                                            <label className="ciLabel">Check Number</label>
                                            <input
                                                className="ciInput"
                                                type="text"
                                                placeholder="Check #"
                                                value={sfcheck}
                                                onChange={(e) => setSfcheck(e.target.value)}
                                            />
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
                                    <div className="ciScheduleRow">
                                        <label className="ciLabel">Payment Schedule</label>
                                        <div className="ciScheduleOptions">
                                            {[
                                                { value: 'ONE_TIME', label: '1 time' },
                                                { value: 'THREE_MONTH', label: '3 month' },
                                                { value: 'SIX_MONTH', label: '6 month' },
                                                { value: 'NINE_MONTH', label: '9 month' },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`ciScheduleBtn ${schedule === opt.value ? 'selected' : ''}`}
                                                    onClick={() => setSchedule(opt.value)}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="ciAchMedia">
                                        <CheckCapture value={check} onChange={setCheck} />
                                        <SignaturePad value={signature} onChange={setSignature} />
                                    </div>
                                </div>

                                <div className="ciSection">
                                    <h3 className="ciSectionTitle">Austin Khidmat</h3>
                                    <div className="ciInlineRow">
                                        <label className="ciInlineLabel">
                                            Khidmat Ramadaniyah
                                            {ciData?.lastYearKr != null && (
                                                <span className="ciLastYear"> (Last year: {formatCurrency(ciData.lastYearKr)})</span>
                                            )}
                                        </label>
                                        <input
                                            className="ciInlineInput"
                                            type="number"
                                            placeholder="Amount"
                                            value={kr}
                                            onChange={(e) => setKr(e.target.value)}
                                        />
                                    </div>
                                    <div className="ciInlineRow">
                                        <label className="ciInlineLabel">
                                            Umoor Taalimiyah
                                            {ciData?.lastYearUt != null && (
                                                <span className="ciLastYear"> (Last year: {formatCurrency(ciData.lastYearUt)})</span>
                                            )}
                                        </label>
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
                                            {formatFmb(ciData?.fmbPledgeAmount, ciData?.fmbPledgeStatus)}
                                        </span>
                                    </div>
                                    <div className="ciInlineRow">
                                        <label className="ciInlineLabel">Masjid</label>
                                        <span className="ciInlineValue">
                                            {ciData?.masjid
                                                ? `${formatK(ciData.masjid.adaa || 0)} out of ${formatK(ciData.masjid.t1 || 0)}`
                                                : 'PENDING'}
                                        </span>
                                    </div>
                                </div>

                                {ciData?.openPledges && ciData.openPledges.length > 0 && (
                                    <div className="ciSection">
                                        <h3 className="ciSectionTitle">Open Pledges</h3>
                                        <ul className="ciPledgeList">
                                            {ciData.openPledges.map((p) => (
                                                <li key={p._id} className="ciPledgeItem">
                                                    <span>{p.qb_id}</span>
                                                    <span>{formatCurrency(p.amount)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

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
