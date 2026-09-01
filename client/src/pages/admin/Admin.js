import React, { useState } from 'react';
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Image } from 'cloudinary-react';
import Nav from '../../components/Nav';
import { GET_SLOTS, GET_HOF_SLOT_STATUSES, GET_HUQOOQ_EXPORT, GET_MAALIYA_VOLUNTEERS, GET_ALL_ACH } from './gql/queries';
import { CREATE_SLOTS, DELETE_SLOT, CANCEL_SIGNUP, REASSIGN_SLOT_GROUP, DELETE_ACH } from './gql/mutations';
import { GET_ALL_ACTIVE_USERS } from '../review/gql/queries';
import { GET_VOLUNTEER_SLOT_GROUPS } from '../volunteer/gql/queries';
import { CLOUD_NAME } from '../../utils/cloudinary';

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    // Slot dates are stored as UTC midnight of the intended day, so format in UTC
    // to avoid a local-timezone off-by-one (e.g. showing Feb 9 for a Feb 10 slot).
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
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

const csvEscape = (value) => {
    if (value == null) return '';
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const downloadCsv = (filename, rows) => {
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

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
    const [confirmSlot, setConfirmSlot] = useState(null);

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
        while (current < endMin) {
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

    const handleDelete = async (slot) => {
        if (slot.bookedBy) {
            setConfirmSlot(slot);
            return;
        }
        await doDelete(slot);
    };

    const doDelete = async (slot) => {
        try {
            await deleteSlot({ variables: { slotId: slot._id } });
            setConfirmSlot(null);
            refetchSlots();
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">Slots</h2>
            <form className="adminForm" onSubmit={handleCreate}>
                <div className="adminFormRow adminDateRow">
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
                        <label>Duration (mins)</label>
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
                                        {slot.bookedBy && (
                                            <span className="adminSlotBookedBy">
                                                {slot.bookedBy.fullName}
                                            </span>
                                        )}
                                        <button
                                            className="adminSlotDeleteBtn"
                                            onClick={() => handleDelete(slot)}
                                            title={slot.bookedBy ? 'Delete booked slot (cancels booking)' : 'Delete slot'}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
            )}

            {confirmSlot && (
                <div className="wjModal" onClick={() => setConfirmSlot(null)}>
                    <div className="wjModalContent" onClick={(e) => e.stopPropagation()}>
                        <h3>Cancel Booked Slot</h3>
                        <p>You are cancelling a booked slot. Are you sure?</p>
                        <div className="wjModalActions">
                            <button className="wjBtnSecondary" onClick={() => setConfirmSlot(null)}>
                                Back
                            </button>
                            <button className="wjBtnPrimary" onClick={() => doDelete(confirmSlot)}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
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
    const [exporting, setExporting] = useState(false);
    const [runExport] = useLazyQuery(GET_HUQOOQ_EXPORT, { fetchPolicy: 'network-only' });

    const handleExport = async () => {
        setExporting(true);
        setError('');
        try {
            const { data: exportData } = await runExport();
            const rows = exportData?.getHuqooqExport || [];
            const header = [
                'ITS', 'Previous Year', 'Name',
                'Wajebaat Amount', 'Wajebaat Check #',
                'Silat ul-Fitr Amount', 'Silat ul-Fitr Check #',
                'Comments',
            ];
            const body = rows.map((r) => [
                r.its, r.previousYear, r.name,
                r.wajebaatAmount, r.wcheck, r.sfAmount, r.sfcheck, r.comments,
            ]);
            downloadCsv('huqooq-export.csv', [header, ...body]);
        } catch (err) {
            setError(err.message);
        }
        setExporting(false);
    };

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
            <div className="adminProgress">
                <div className="adminProgressTrack">
                    <div
                        className="adminProgressFill"
                        style={{ width: `${statuses.length ? (signedUpCount / statuses.length) * 100 : 0}%` }}
                    />
                </div>
                <div className="adminProgressLabel">{signedUpCount} of {statuses.length} signed up</div>
            </div>

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
                                <th>Date</th>
                                <th>Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((s) => (
                                <tr key={s.user._id} className={!s.slot ? 'adminRowNoSlot' : ''}>
                                    <td>{s.user.fullName}</td>
                                    <td>{s.user.zone}</td>
                                    <td>{s.slot ? formatDate(s.slot.date) : ''}</td>
                                    <td>{s.slot ? formatTime12(s.slot.startTime) : ''}</td>
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

            <div className="adminExportRow">
                <button className="adminBtn" onClick={handleExport} disabled={exporting}>
                    {exporting ? 'Exporting…' : 'Export'}
                </button>
            </div>
        </div>
    );
}


// ── Section 5: Volunteer Management ──

function VolunteerManagement() {
    const { data: groupsData, loading: groupsLoading, refetch: refetchGroups } = useQuery(GET_VOLUNTEER_SLOT_GROUPS);
    const { data: volunteersData, loading: volunteersLoading } = useQuery(GET_MAALIYA_VOLUNTEERS);
    const [reassignSlotGroup] = useMutation(REASSIGN_SLOT_GROUP);
    const [error, setError] = useState('');

    const groups = groupsData?.getVolunteerSlotGroups || [];
    const volunteers = volunteersData?.getMaaliyaVolunteers || [];

    const GROUP_ORDER = ['After Zohr Asr', 'Before Maghrib Isha', 'After Maghrib Isha'];

    const groupsByDate = {};
    groups.forEach((g) => {
        if (!groupsByDate[g.date]) groupsByDate[g.date] = [];
        groupsByDate[g.date].push(g);
    });

    const dateKeys = Object.keys(groupsByDate).sort();

    const handleReassign = async (date, group, volunteerId) => {
        setError('');
        try {
            await reassignSlotGroup({ variables: { date, group, volunteerId } });
            refetchGroups();
        } catch (err) {
            setError(err.message);
        }
    };

    if (groupsLoading || volunteersLoading) return <p>Loading...</p>;

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">Volunteer Assignments</h2>
            {error && <p className="adminError">{error}</p>}

            {dateKeys.length === 0 ? (
                <p className="adminEmpty">No slot groups available.</p>
            ) : (
                <div className="adminTableWrapper">
                    <table className="adminTable">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Group</th>
                                <th>Volunteer</th>
                                <th>Override</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dateKeys.flatMap((dateKey) =>
                                groupsByDate[dateKey]
                                    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
                                    .map((g) => (
                                        <tr key={`${g.date}-${g.group}`}>
                                            <td>{formatDate(g.date)}</td>
                                            <td>{g.group}</td>
                                            <td>{g.volunteer?.fullName || 'Unassigned'}</td>
                                            <td>
                                                <select
                                                    value={g.volunteer?._id || ''}
                                                    onChange={(e) => handleReassign(g.date, g.group, e.target.value)}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {volunteers.map((v) => (
                                                        <option key={v._id} value={v._id}>
                                                            {v.fullName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Section 6: ACH Details ──

function ACHTable() {
    const { data, loading, refetch } = useQuery(GET_ALL_ACH);
    const [deleteACH] = useMutation(DELETE_ACH);
    const [viewer, setViewer] = useState(null); // { title, publicId }
    const [confirmId, setConfirmId] = useState(''); // achId pending deletion
    const [deletingId, setDeletingId] = useState('');
    const [error, setError] = useState('');

    const rows = data?.getAllACH || [];

    const handleDelete = async (achId) => {
        setError('');
        setConfirmId('');
        setDeletingId(achId);
        try {
            // The server deletes the check + signature images from Cloudinary
            // (API secret lives in a server env var) then removes the record.
            await deleteACH({ variables: { achId } });
            await refetch();
        } catch (err) {
            setError(err.message);
        }
        setDeletingId('');
    };

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">ACH Details</h2>
            {error && <p className="adminError">{error}</p>}

            {loading ? (
                <p>Loading…</p>
            ) : rows.length === 0 ? (
                <p className="adminEmpty">No ACH records.</p>
            ) : (
                <div className="adminTableWrapper">
                    <table className="adminTable">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Account Number</th>
                                <th>Routing Number</th>
                                <th>Check</th>
                                <th>Sign</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r._id}>
                                    <td>{r.user?.fullName || '—'}</td>
                                    <td>{r.accountNumber || '—'}</td>
                                    <td>{r.routingNumber || '—'}</td>
                                    <td>
                                        {r.check ? (
                                            <button
                                                className="adminLinkBtn"
                                                onClick={() => setViewer({ title: 'Voided Check', publicId: r.check })}
                                            >
                                                View Check
                                            </button>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        {r.signature ? (
                                            <button
                                                className="adminLinkBtn"
                                                onClick={() => setViewer({ title: 'Signature', publicId: r.signature })}
                                            >
                                                View Sign
                                            </button>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <button
                                            className="adminCancelBtn"
                                            onClick={() => setConfirmId(r._id)}
                                            disabled={deletingId === r._id}
                                        >
                                            {deletingId === r._id ? 'Deleting…' : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {confirmId && (
                <div className="modalOverlay" onClick={() => setConfirmId('')}>
                    <div className="modalCard" onClick={(e) => e.stopPropagation()}>
                        <h3>Delete ACH Record</h3>
                        <p className="achConfirmText">
                            The Check and Signature will be deleted with the ACH record.
                        </p>
                        <div className="achConfirmActions">
                            <button className="wjBtnSecondary" onClick={() => setConfirmId('')}>
                                Cancel
                            </button>
                            <button className="achConfirmDeleteBtn" onClick={() => handleDelete(confirmId)}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewer && (
                <div className="modalOverlay" onClick={() => setViewer(null)}>
                    <div className="achViewerModal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="achViewerTitle">{viewer.title}</h3>
                        <div className="achViewerImgWrap">
                            <Image
                                cloudName={CLOUD_NAME}
                                publicId={viewer.publicId}
                                width="700"
                                crop="fit"
                                alt={viewer.title}
                            />
                        </div>
                        <button className="wjBtnSecondary" onClick={() => setViewer(null)}>
                            Close
                        </button>
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
                <VolunteerManagement />
                <ACHTable />
            </div>
        </>
    );
}
