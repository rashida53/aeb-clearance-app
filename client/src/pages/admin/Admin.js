import React, { useState } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_SLOTS, GET_SLOTS_BY_DATE, GET_HOF_SLOT_STATUSES, LOOKUP_ACH } from './gql/queries';
import { CREATE_SLOTS, DELETE_SLOT, CANCEL_SIGNUP } from './gql/mutations';
import { GET_ALL_ACTIVE_USERS } from '../review/gql/queries';

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

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

// ── Time Picker ──

function TimePicker({ value, onChange }) {
    const parts = value ? value.split(':') : ['', ''];
    const hour24 = parts[0] ? parseInt(parts[0]) : null;
    const minute = parts[1] || '';
    const period = hour24 !== null ? (hour24 >= 12 ? 'PM' : 'AM') : '';
    const hour12 = hour24 !== null ? (hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24) : '';

    const buildTime = (h12, min, p) => {
        if (h12 === '' || min === '' || p === '') return '';
        let h24 = parseInt(h12);
        if (p === 'AM' && h24 === 12) h24 = 0;
        if (p === 'PM' && h24 !== 12) h24 += 12;
        return String(h24).padStart(2, '0') + ':' + min;
    };

    return (
        <div className="adminTimeSelect">
            <select
                value={hour12}
                onChange={(e) => onChange(buildTime(e.target.value, minute || '00', period || 'AM'))}
                required
            >
                <option value="">Hr</option>
                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                    <option key={h} value={h}>{h}</option>
                ))}
            </select>
            <select
                value={minute}
                onChange={(e) => onChange(buildTime(hour12 || 12, e.target.value, period || 'AM'))}
                required
            >
                <option value="">Min</option>
                <option value="00">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
            </select>
            <select
                value={period}
                onChange={(e) => onChange(buildTime(hour12 || 12, minute || '00', e.target.value))}
                required
            >
                <option value="">AM/PM</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
    );
}

// ── Section 1: Slot Creation ──

function SlotCreation() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [duration, setDuration] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const { data: slotsData, loading: slotsLoading, refetch: refetchSlots } = useQuery(GET_SLOTS);
    const [createSlots, { loading: creating }] = useMutation(CREATE_SLOTS);
    const [deleteSlot] = useMutation(DELETE_SLOT);

    const slots = slotsData?.getSlots || [];

    const slotsByDate = {};
    slots.forEach((slot) => {
        const dateKey = slot.date.split('T')[0];
        if (!slotsByDate[dateKey]) slotsByDate[dateKey] = [];
        slotsByDate[dateKey].push(slot);
    });

    const previewCount = () => {
        if (!startDate || !endDate || !startTime || !endTime || !duration) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) return 0;

        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (startMin >= endMin) return 0;

        const dur = parseInt(duration);
        if (dur <= 0) return 0;

        let slotsPerDay = 0;
        let current = startMin;
        while (current <= endMin) {
            slotsPerDay++;
            current += dur;
        }

        const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        return slotsPerDay * days;
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const { data } = await createSlots({
                variables: {
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    duration: parseInt(duration),
                },
            });
            setSuccess(`Created ${data.createSlots.length} slots.`);
            setStartDate('');
            setEndDate('');
            setStartTime('');
            setEndTime('');
            setDuration('');
            refetchSlots();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (slotId) => {
        try {
            await deleteSlot({ variables: { slotId } });
            refetchSlots();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">Slots</h2>
            <form className="adminForm" onSubmit={handleCreate}>
                <div className="adminFormRow">
                    <div className="adminFormGroup">
                        <label>Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            min="2027-02-07"
                            max="2027-03-05"
                            required
                        />
                    </div>
                    <div className="adminFormGroup">
                        <label>End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min="2027-02-07"
                            max="2027-03-05"
                            required
                        />
                    </div>
                </div>
                <div className="adminFormRow">
                    <div className="adminFormGroup">
                        <label>Start Time</label>
                        <TimePicker value={startTime} onChange={setStartTime} />
                    </div>
                    <div className="adminFormGroup">
                        <label>End Time</label>
                        <TimePicker value={endTime} onChange={setEndTime} />
                    </div>
                    <div className="adminFormGroup">
                        <label>Duration (min)</label>
                        <input
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            min="1"
                            placeholder=""
                            required
                        />
                    </div>
                </div>
                {previewCount() > 0 && (
                    <p className="adminPreview">This will create {previewCount()} slots.</p>
                )}
                {error && <p className="adminError">{error}</p>}
                {success && <p className="adminSuccess">{success}</p>}
                <button type="submit" className="adminBtn" disabled={creating}>
                    {creating ? 'Creating…' : 'Create'}
                </button>
            </form>

            <h3 className="adminSubTitle">Existing Slots</h3>
            {slotsLoading ? (
                <p>Loading slots…</p>
            ) : Object.keys(slotsByDate).length === 0 ? (
                <p className="adminEmpty">No slots created yet.</p>
            ) : (
                Object.keys(slotsByDate)
                    .sort()
                    .map((dateKey) => (
                        <div key={dateKey} className="adminSlotDateGroup">
                            <h4 className="adminSlotDate">{formatDate(dateKey)}</h4>
                            <div className="adminSlotChips">
                                {slotsByDate[dateKey].map((slot) => (
                                    <div
                                        key={slot._id}
                                        className={`adminSlotChip ${slot.bookedBy ? 'booked' : ''}`}
                                    >
                                        <span>{formatTime12(slot.startTime)}</span>
                                        {slot.bookedBy ? (
                                            <span className="adminSlotBookedBy">
                                                {slot.bookedBy.fullName}
                                            </span>
                                        ) : (
                                            <button
                                                className="adminSlotDeleteBtn"
                                                onClick={() => handleDelete(slot._id)}
                                                title="Delete slot"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
            )}
        </div>
    );
}

// ── Section 2: HOF Dashboard ──

function HOFDashboard() {
    const { data, loading } = useQuery(GET_HOF_SLOT_STATUSES);
    const [cancelSignup] = useMutation(CANCEL_SIGNUP);
    const [filter, setFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('NAME');
    const [error, setError] = useState('');

    const statuses = data?.getHOFSlotStatuses || [];

    const filtered = statuses.filter((s) => {
        if (filter === 'SIGNED_UP') return s.slot != null;
        if (filter === 'NOT_SIGNED_UP') return s.slot == null;
        return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'NAME') {
            return a.user.fullName.localeCompare(b.user.fullName);
        }
        if (!a.slot && !b.slot) return a.user.fullName.localeCompare(b.user.fullName);
        if (!a.slot) return 1;
        if (!b.slot) return -1;
        return new Date(a.slot.date) - new Date(b.slot.date) || a.slot.startTime.localeCompare(b.slot.startTime);
    });

    const handleCancel = async (slotId) => {
        setError('');
        try {
            await cancelSignup({
                variables: { slotId },
                refetchQueries: [{ query: GET_HOF_SLOT_STATUSES }],
            });
        } catch (err) {
            setError(err.message);
        }
    };

    const signedUpCount = statuses.filter((s) => s.slot != null).length;

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">HOF Dashboard</h2>
            <p className="adminSubText">{signedUpCount} of {statuses.length} signed up</p>

            <div className="adminControls">
                <div className="adminFormGroup">
                    <label>Filter</label>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="ALL">All</option>
                        <option value="SIGNED_UP">Signed Up</option>
                        <option value="NOT_SIGNED_UP">Not Signed Up</option>
                    </select>
                </div>
                <div className="adminFormGroup">
                    <label>Sort By</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="NAME">Name</option>
                        <option value="DATE">Slot Date</option>
                    </select>
                </div>
            </div>

            {error && <p className="adminError">{error}</p>}

            {loading ? (
                <p>Loading…</p>
            ) : (
                <div className="adminTableWrapper">
                    <table className="adminTable">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Zone</th>
                                <th>Slot Date</th>
                                <th>Slot Time</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((s) => (
                                <tr key={s.user._id} className={!s.slot ? 'adminRowNoSlot' : ''}>
                                    <td>{s.user.fullName}</td>
                                    <td>{s.user.zone}</td>
                                    <td>{s.slot ? formatDate(s.slot.date) : '—'}</td>
                                    <td>{s.slot ? formatTime12(s.slot.startTime) : '—'}</td>
                                    <td>
                                        {s.slot ? (
                                            <button
                                                className="adminCancelBtn"
                                                onClick={() => handleCancel(s.slot._id)}
                                            >
                                                Cancel
                                            </button>
                                        ) : (
                                            <span className="adminNotSignedUp">Not signed up</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Section 3: Daily Schedule ──

function DailySchedule() {
    const [selectedDate, setSelectedDate] = useState('');
    const { data, loading } = useQuery(GET_SLOTS_BY_DATE, {
        variables: { date: selectedDate },
        skip: !selectedDate,
    });

    const slots = data?.getSlotsByDate || [];

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">Daily Schedule</h2>
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

            {selectedDate && loading && <p>Loading…</p>}

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
    );
}

// ── Section 4: ACH Lookup ──

function ACHLookup() {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false);

    const { data: usersData, loading: usersLoading } = useQuery(GET_ALL_ACTIVE_USERS);
    const activeUsers = usersData?.getAllActiveUsers || [];

    const [fetchACH, { data: achData, loading: achLoading }] = useLazyQuery(LOOKUP_ACH);

    const filteredUsers = searchTerm
        ? activeUsers.filter((u) => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
        : [];

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setSelectedUser(null);
        setShowDropdown(true);
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSearchTerm(user.fullName);
        setShowDropdown(false);
        fetchACH({ variables: { userId: user._id } });
    };

    const handleBlur = () => {
        setTimeout(() => setShowDropdown(false), 200);
    };

    const achInfo = achData?.lookupACH;

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">ACH Lookup</h2>
            <div className="adminFormGroup">
                <label>Search HOF Name</label>
                <div className="reviewTypeahead">
                    <input
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

            {selectedUser && achLoading && <p>Loading ACH details…</p>}

            {selectedUser && !achLoading && !achInfo && (
                <p className="adminEmpty">No ACH record found for {selectedUser.fullName}.</p>
            )}

            {selectedUser && !achLoading && achInfo && (
                <div className="adminACHCard">
                    <h3>{achInfo.user.fullName}</h3>
                    <div className="adminACHDetail">
                        <label>Account Number</label>
                        <span>{achInfo.accountNumber}</span>
                    </div>
                    <div className="adminACHDetail">
                        <label>Routing Number</label>
                        <span>{achInfo.routingNumber}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Admin Page ──

export default function Admin() {
    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="adminHeader">
                    <h1>Treasurer</h1>
                </div>
                <SlotCreation />
                <HOFDashboard />
                <DailySchedule />
                <ACHLookup />
            </div>
        </>
    );
}
