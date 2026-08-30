import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ALL_ACTIVE_USERS, GET_APPROVALS_BY_REQUESTER, GET_MASJID_NIYYAT_FOR_USER } from './gql/queries';
import { CREATE_APPROVAL } from './gql/mutations';
import { GET_MY_OPEN_BALANCES } from '../openBalances/gql/queries';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatWholeCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const ANIM_DURATION = 2000;

const MasjidNiyyatBar = ({ t1, t2, adaa }) => {
    const max = t2 || t1;
    const targetPct = max > 0 ? Math.min((adaa / max) * 100, 100) : 0;
    const t1Pct = max > 0 ? (t1 / max) * 100 : 0;

    const [animPct, setAnimPct] = useState(0);
    const [displayAdaa, setDisplayAdaa] = useState(0);
    const started = useRef(false);
    const sectionRef = useRef(null);

    useEffect(() => {
        if (started.current || !adaa) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting || started.current) return;
                started.current = true;
                observer.disconnect();
                const start = performance.now();
                const tick = (now) => {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / ANIM_DURATION, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    setAnimPct(targetPct * eased);
                    setDisplayAdaa(Math.round(adaa * eased));
                    if (progress < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            },
            { threshold: 0.3 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, [adaa, targetPct]);

    return (
        <div ref={sectionRef}>
            <div className="niyyatBarWrap">
                <div className="niyyatTrack">
                    <div className="niyyatFill" style={{ width: `${animPct}%` }} />
                    <div className="niyyatMilestone" style={{ left: `${t1Pct}%` }}>
                        <div className="niyyatMilestoneLine" />
                        <div className="niyyatMilestoneLabel">
                            <span className="niyyatMilestoneName">Niyyat</span>
                            <span className="niyyatMilestoneAmt">{formatWholeCurrency(t1)}</span>
                        </div>
                    </div>
                    <div className="niyyatMilestone" style={{ right: 0 }}>
                        <div className="niyyatMilestoneLine" />
                        <div className="niyyatMilestoneLabel">
                            <span className="niyyatMilestoneName">Future Niyyat</span>
                            <span className="niyyatMilestoneAmt">{formatWholeCurrency(t2)}</span>
                        </div>
                    </div>
                    <div className="niyyatAdaa">
                        <span className="niyyatMilestoneName">Adaa</span>
                        <span className="niyyatMilestoneAmt">{formatWholeCurrency(displayAdaa)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const formatDueDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const Review = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [masjid, setMasjid] = useState('');
    const [approveSuccess, setApproveSuccess] = useState(false);

    const [createApproval, { loading: approving }] = useMutation(CREATE_APPROVAL);

    const { data: usersData, loading: usersLoading } = useQuery(GET_ALL_ACTIVE_USERS);
    const activeUsers = usersData?.getAllActiveUsers || [];

    const filteredUsers = searchTerm
        ? activeUsers.filter((u) =>
              u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : [];

    const { data: balancesData, loading: balancesLoading } = useQuery(GET_MY_OPEN_BALANCES, {
        variables: { hofIts: selectedUser?.hofIts || '' },
        skip: !selectedUser,
    });

    const { data: approvalsData, loading: approvalsLoading } = useQuery(GET_APPROVALS_BY_REQUESTER, {
        variables: { userId: selectedUser?._id || '' },
        skip: !selectedUser,
    });

    const { data: niyyatData, loading: niyyatLoading } = useQuery(GET_MASJID_NIYYAT_FOR_USER, {
        variables: { userId: selectedUser?._id || '' },
        skip: !selectedUser,
    });

    const niyyat = niyyatData?.getMasjidNiyyatForUser;

    const pastApprovals = approvalsData?.getApprovalsByRequester || [];

    const balances = balancesData?.getMyOpenBalances || [];
    const total = balances.reduce((sum, b) => sum + (b.balance || 0), 0);

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setSelectedUser(null);
        setShowDropdown(true);
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSearchTerm(user.fullName);
        setShowDropdown(false);
        setRemarks('');
        setMasjid('');
        setApproveSuccess(false);
    };

    const handleApprove = async () => {
        await createApproval({
            variables: {
                hofIts: selectedUser.hofIts,
                requester: selectedUser._id,
                remarks: remarks.trim(),
                masjid: masjid.trim(),
            },
        });
        setApproveSuccess(true);
        setRemarks('');
        setMasjid('');
    };

    const handleBlur = () => {
        setTimeout(() => setShowDropdown(false), 200);
    };

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="reviewCard">
                    <div className="reviewHeader">
                        <h1>Review Pledges</h1>
                    </div>

                    <div className="reviewSearchSection">
                        <label htmlFor="userSearch">HOF Name</label>
                        <div className="reviewTypeahead">
                            <input
                                id="userSearch"
                                type="text"
                                value={searchTerm}
                                onChange={handleInputChange}
                                onFocus={() => searchTerm && setShowDropdown(true)}
                                onBlur={handleBlur}
                                placeholder={usersLoading ? 'Loading members…' : 'Type to search…'}
                                className="reviewSearchInput"
                                autoComplete="off"
                            />
                            {showDropdown && searchTerm && (
                                <div className="reviewDropdown">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((u) => (
                                            <div
                                                key={u._id}
                                                className="reviewDropdownOption"
                                                onMouseDown={() => handleSelectUser(u)}
                                            >
                                                {u.fullName}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="reviewDropdownEmpty">No members found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedUser && (
                        <div className="reviewResults">
                            <div className="reviewMemberInfo">
                                <h3>{selectedUser.fullName}</h3>
                                <span className="reviewMemberMeta">
                                    HOF ITS: {selectedUser.hofIts}
                                </span>
                            </div>

                            {balancesLoading ? (
                                <div className="loadingState">Loading balances…</div>
                            ) : balances.length === 0 ? (
                                <div className="noBalances">
                                    <h3>All clear!</h3>
                                    <p>No outstanding balances for this member.</p>
                                </div>
                            ) : (
                                <>
                                    <p className="reviewTotal">Total Due: {formatCurrency(total)}</p>
                                    <div className="reviewTableWrapper">
                                        <table className="reviewTable">
                                            <thead>
                                                <tr>
                                                    <th>Pledge</th>
                                                    <th>Amount</th>
                                                    <th>Balance</th>
                                                    <th>Due</th>
                                                    <th>Plan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {balances.map((b) => {
                                                    const isOverdue = b.balance === b.amount;
                                                    return (
                                                        <tr
                                                            key={b._id}
                                                            className={isOverdue ? 'reviewRowOverdue' : ''}
                                                        >
                                                            <td>{b.qb_id}</td>
                                                            <td>{b.amount != null ? formatCurrency(b.amount) : '—'}</td>
                                                            <td>{formatCurrency(b.balance)}</td>
                                                            <td>{formatDueDate(b.due)}</td>
                                                            <td>{b.pp?.toUpperCase() === 'LIKELY' ? 'LIKELY' : 'UNKNOWN'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="reviewTotalRow">
                                                    <td colSpan="2">Total</td>
                                                    <td colSpan="3">{formatCurrency(total)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}

                            <div className="reviewPastApprovalsSection">
                                <h3 className="reviewPastApprovalsTitle">Masjid Niyyat</h3>
                                {niyyatLoading ? (
                                    <div className="loadingState">Loading Masjid Niyyat…</div>
                                ) : !niyyat ? (
                                    <div className="reviewNoPastApprovals">Takhmeen Pending</div>
                                ) : !niyyat.adaa ? (
                                    <p className="reviewNiyyatCommitted">
                                        Committed {formatWholeCurrency(niyyat.t1)} but no payments yet.
                                    </p>
                                ) : (
                                    <MasjidNiyyatBar t1={niyyat.t1} t2={niyyat.t2} adaa={niyyat.adaa} />
                                )}
                            </div>

                            <div className="reviewPastApprovalsSection">
                                <h3 className="reviewPastApprovalsTitle">Past Approvals</h3>
                                {approvalsLoading ? (
                                    <div className="loadingState">Loading past approvals…</div>
                                ) : pastApprovals.length === 0 ? (
                                    <div className="reviewNoPastApprovals">No past approvals found.</div>
                                ) : (
                                    <div className="reviewTableWrapper">
                                        <table className="reviewTable">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Approver</th>
                                                    <th>Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pastApprovals.map((a) => (
                                                    <tr key={a._id}>
                                                        <td>
                                                            {new Date(a.approvedAt).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </td>
                                                        <td>{a.approver}</td>
                                                        <td>{a.remarks}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="reviewApprovalSection">
                                {approveSuccess ? (
                                    <div className="letterSuccessMsg">
                                        Approved. Requester can now generate the letter.
                                    </div>
                                ) : (
                                    <>
                                        <div className="formGroup">
                                            <label htmlFor="remarks">Remarks</label>
                                            <textarea
                                                id="remarks"
                                                className="reviewRemarksTextarea"
                                                value={remarks}
                                                onChange={e => setRemarks(e.target.value)}
                                                placeholder="Explain the approval..."
                                                rows={4}
                                            />
                                        </div>
                                        <div className="formGroup">
                                            <label htmlFor="masjid">MASJID</label>
                                            <textarea
                                                id="masjid"
                                                className="reviewRemarksTextarea"
                                                value={masjid}
                                                onChange={e => setMasjid(e.target.value)}
                                                placeholder="Enter Masjid notes here..."
                                                rows={4}
                                            />
                                        </div>
                                        <button
                                            className="reviewApproveBtn"
                                            disabled={!remarks.trim() || !masjid.trim() || approving}
                                            onClick={handleApprove}
                                        >
                                            {approving ? 'Saving...' : 'Approve'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default Review;
