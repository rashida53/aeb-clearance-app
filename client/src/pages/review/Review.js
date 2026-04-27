import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ALL_ACTIVE_USERS } from './gql/queries';
import { CREATE_APPROVAL } from './gql/mutations';
import { GET_MY_OPEN_BALANCES } from '../openBalances/gql/queries';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

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
        setApproveSuccess(false);
    };

    const handleApprove = async () => {
        await createApproval({
            variables: {
                hofIts: selectedUser.hofIts,
                requester: selectedUser._id,
                remarks: remarks.trim(),
            },
        });
        setApproveSuccess(true);
        setRemarks('');
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
                                                            <td>{b.pp === 'Likely' ? 'LIKELY' : 'UNKNOWN'}</td>
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

                            <div className="reviewApprovalSection">
                                {approveSuccess ? (
                                    <div className="letterSuccessMsg">
                                        Approved. Please regenerate the letter.
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
                                        <button
                                            className="reviewApproveBtn"
                                            disabled={!remarks.trim() || approving}
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
