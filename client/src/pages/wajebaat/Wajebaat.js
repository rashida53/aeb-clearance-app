import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import Auth from '../../utils/auth';
import { GET_MY_WAJEBAAT_STATUS, GET_AVAILABLE_SLOTS } from './gql/queries';
import { SUBMIT_COMMITMENTS, SUBMIT_ACH, DEFER_ACH, EMAIL_APPOINTMENT, BOOK_SLOT, CANCEL_MY_SLOT } from './gql/mutations';
import { GET_MY_OPEN_BALANCES } from '../openBalances/gql/queries';
import { GET_ME } from '../user/gql/queries';
import CheckCapture from './components/CheckCapture';
import SignaturePad from './components/SignaturePad';

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    // Slot dates are stored as UTC midnight of the intended day; format in UTC to
    // avoid a local-timezone off-by-one (e.g. showing Feb 9 for a Feb 10 slot).
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const formatTime12 = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const STEP_INTRO = 'INTRO';
const STEP_KR = 'KR';
const STEP_UT = 'UT';
const STEP_ACH = 'ACH';
const STEP_PLEDGES = 'PLEDGES';
const STEP_SCHEDULER = 'SCHEDULER';

// Renders the label with the main text bold and any "(...)" note in normal weight.
const renderItemLabel = (label) => {
    const idx = label.indexOf('(');
    if (idx === -1) return <strong>{label}</strong>;
    return (
        <>
            <strong>{label.slice(0, idx).trim()}</strong>{' '}
            <span className="wjItemNote">{label.slice(idx)}</span>
        </>
    );
};

const KR_ITEMS = [
    { key: 'lailatulQadr', label: 'Austin Lailatul Qadr Niyaaz (After Maghrib and Sihori)' },
    { key: 'hazratAaliyah', label: 'Hazrat Aaliyah Niyaaz (Iftaari in Aqa Maula TUS Hazrat)' },
    { key: 'hajjEBadal', label: 'Hajj e Badal (Support Hajj Logistics)' },
    { key: 'moaasaat', label: 'Marafiq Burhaniyah (Support Mumineen through Moasaat)' },
];

const UT_ITEMS = [
    { key: 'madrasahTulBadri', label: 'Madrasah tul Badri' },
    { key: 'raudatAlQuran', label: 'Raudat al Quran Academy' },
];

const CHECKLIST_ITEMS = [
    'Wuzu',
    'Remind your family to attend with you',
    'Wajebaat Check',
    'Sila Fitra Check',
    'Raza Saheb Ikraam',
    'Screenshot of this page',
];

// ── Intro Step ──

function IntroStep({ onNext }) {
    return (
        <div className="wjStep">
            <p className="wjStepDesc">
                We aim to make the process efficient by eliminating paper forms and collecting Niyyats for local khidmats before the appointment. The system will guide you through these prerequisites and pick a Wajebaat appointment slot.
            </p>
            <p className="wjStepDesc">What we will need:</p>
            <ul className="wjIntroList">
                <li>Niyyat for Khidmat Ramadaniyah</li>
                <li>Niyyat for Umoor Taalimiyah</li>
                <li>ACH authorization and payment plan duration</li>
            </ul>
            <p className="wjStepDesc">
                Please contact a member from Umoor Maaliyah if you have any questions.
            </p>
            <div className="wjContactGrid">
                <div className="wjContactCard">
                    <div className="wjContactName">M Taaha bhai Bhora</div>
                    <div className="wjContactDesignation">Treasurer</div>
                    <a href="tel:6823653910" className="wjContactPhone">682-365-3910</a>
                </div>
                <div className="wjContactCard">
                    <div className="wjContactName">M Murtaza bhai Kutianawala</div>
                    <div className="wjContactDesignation">Masjid Committee</div>
                    <a href="tel:5126585643" className="wjContactPhone">512-658-5643</a>
                </div>
                <div className="wjContactCard">
                    <div className="wjContactName">M Murtaza bhai Malbari</div>
                    <div className="wjContactDesignation">Taalimiyah Coordinator</div>
                    <a href="tel:6318381740" className="wjContactPhone">631-838-1740</a>
                </div>
                <div className="wjContactCard">
                    <div className="wjContactName">M Hamza bhai Karachiwala</div>
                    <div className="wjContactDesignation">FMB Coordinator</div>
                    <a href="tel:6143776967" className="wjContactPhone">614-377-6967</a>
                </div>
            </div>
            <div className="wjStepActions">
                <button className="wjBtnPrimary" onClick={onNext}>
                    Begin
                </button>
            </div>
        </div>
    );
}

// ── Miqaat Info Box ──

function MiqaatInfoBox({ miqaats }) {
    if (!miqaats || miqaats.length === 0) return null;

    return (
        <div className="wjMiqaatBox">
            <h3>Your Miqaat Hosting Dates</h3>
            <ul>
                {miqaats.map((m) => (
                    <li key={m._id}>
                        {formatDate(m.date)} — {m.title}
                        {m.hijriDate ? ` (${m.hijriDate})` : ''}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── Masked Input ──

function MaskedInput({ value, onChange, placeholder, label }) {
    const masked = value.length > 4
        ? '•'.repeat(value.length - 4) + value.slice(-4)
        : value;

    const handleChange = (e) => {
        const input = e.target.value;
        if (input.length < value.length) {
            onChange(value.slice(0, input.length));
        } else {
            const newChars = input.slice(value.length);
            onChange(value + newChars.replace(/[^0-9]/g, ''));
        }
    };

    return (
        <div className="wjFormGroup">
            <label>{label}</label>
            <input
                type="text"
                value={masked}
                onChange={handleChange}
                placeholder={placeholder}
                autoComplete="off"
                inputMode="numeric"
            />
        </div>
    );
}

// ── Commitment Step ──

function CommitmentStep({ title, description, amount, onAmountChange, onDefer, onNext, onBack, lastYearAmount, minAmount = 353, unitHint, items }) {
    const parsedAmount = amount ? parseFloat(amount) : 0;
    const belowMin = minAmount > 0 && amount && parsedAmount < minAmount;
    const isValid = amount && parsedAmount > 0 && (!minAmount || parsedAmount >= minAmount);
    const [showHint, setShowHint] = useState(false);

    const isItemized = Array.isArray(items) && items.length > 0;
    // Per-item amounts. When any are entered the Total is locked to their sum;
    // otherwise the Total acts as a directly-editable lumpsum field.
    const [itemValues, setItemValues] = useState(() =>
        isItemized ? Object.fromEntries(items.map((i) => [i.key, ''])) : {}
    );
    // Lumpsum seeded from any prefilled amount (we can't reconstruct a breakdown).
    const [lumpValue, setLumpValue] = useState(isItemized ? (amount || '') : '');

    const itemsTotal = Object.values(itemValues).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    const anyItem = Object.values(itemValues).some((v) => v !== '');

    const handleItemChange = (key, val) => {
        const next = { ...itemValues, [key]: val };
        setItemValues(next);
        const entered = Object.values(next).some((v) => v !== '');
        const total = Object.values(next).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
        onAmountChange(entered && total ? String(total) : '');
    };

    const handleLumpChange = (val) => {
        setLumpValue(val);
        onAmountChange(val);
    };

    const handleDefer = () => {
        // Clear every field and treat the commitment as null before moving on.
        if (isItemized) {
            setItemValues(Object.fromEntries(items.map((i) => [i.key, ''])));
            setLumpValue('');
        }
        onAmountChange('');
        onDefer();
    };

    useEffect(() => {
        setShowHint(false);
        if (!amount || !belowMin) return;
        const timer = setTimeout(() => setShowHint(true), 3000);
        return () => clearTimeout(timer);
    }, [amount, belowMin]);

    return (
        <div className="wjStep">
            <h2 className="wjStepTitle">{title}</h2>
            {description && <p className="wjStepDesc">{description}</p>}

            {isItemized && (
                <p className="wjNiyyatNote">
                    You can provide an item wise niyyat or a collective niyyat at the bottom
                </p>
            )}

            {lastYearAmount > 0 && (
                <div className="wjLastYear">
                    Last year, you committed ${Math.round(lastYearAmount)} towards this cause
                </div>
            )}

            {isItemized ? (
                <>
                    <div className="wjItemizedList">
                        {items.map((item) => (
                            <div key={item.key} className="wjFormGroupInline wjItemRow">
                                <label>{renderItemLabel(item.label)}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={itemValues[item.key]}
                                    onChange={(e) => handleItemChange(item.key, e.target.value)}
                                    disabled={lumpValue !== ''}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="wjFormGroupInline wjTotalRow">
                        <label>Total ($)</label>
                        <input
                            type="number"
                            min="0"
                            value={anyItem ? String(itemsTotal) : lumpValue}
                            onChange={(e) => handleLumpChange(e.target.value)}
                            disabled={anyItem}
                        />
                    </div>
                </>
            ) : (
                <div className="wjFormGroupInline">
                    <label>Amount ($)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => onAmountChange(e.target.value)}
                        min="0"
                        placeholder=""
                    />
                </div>
            )}
            {showHint && unitHint && <p className="wjUnitHint">{unitHint}</p>}

            <div className="wjStepActions">
                {onBack && (
                    <button className="wjBtnSecondary" onClick={onBack}>
                        Back
                    </button>
                )}
                <button className="wjBtnSecondary" onClick={handleDefer}>
                    Defer
                </button>
                <button className="wjBtnPrimary" onClick={onNext} disabled={!isValid}>
                    Next
                </button>
            </div>
        </div>
    );
}

// ── ACH Step ──

function ACHStep({ onSubmit, onBack, onDefer, submitting, existingACH, existingSchedule }) {
    const [accountNumber, setAccountNumber] = useState(existingACH?.accountNumber || '');
    const [routingNumber, setRoutingNumber] = useState(existingACH?.routingNumber || '');
    const [schedule, setSchedule] = useState(existingSchedule || '');
    const [authorized, setAuthorized] = useState(!!existingACH?.authorized);
    const [check, setCheck] = useState(existingACH?.check || null);
    const [signature, setSignature] = useState(existingACH?.signature || null);
    const [showIncomplete, setShowIncomplete] = useState(false);

    const isValid = accountNumber.length >= 8 && routingNumber.length >= 9 && schedule && authorized && !!signature && !!check;

    const handleSubmit = () => {
        if (!isValid) {
            setShowIncomplete(true);
            return;
        }
        onSubmit({ accountNumber, routingNumber, schedule, authorized, check, signature });
    };

    const scheduleOptions = [
        { value: 'ONE_TIME', label: '1 time' },
        { value: 'THREE_MONTH', label: '3 month' },
        { value: 'SIX_MONTH', label: '6 month' },
        { value: 'NINE_MONTH', label: '9 month' },
    ];

    return (
        <div className="wjStep">
            <h2 className="wjStepTitle"><span style={{ color: 'var(--color-gold)' }}>ACH Authorization</span></h2>
            <p className="wjStepDesc">Please provide your ACH details for the earlier commitments. This saves our teams the efforts to reach out to all families over the year for payments. <span style={{ fontWeight: 'bold', color: 'var(--color-gold)' }}>The information is encrypted and can only be accessed by the Jamaat Treasurer.</span></p>

            <MaskedInput
                label="Bank Account Number (8-17 digits)"
                value={accountNumber}
                onChange={setAccountNumber}
                placeholder="Enter account number"
            />
            <MaskedInput
                label="Routing Number (9 digits)"
                value={routingNumber}
                onChange={setRoutingNumber}
                placeholder="Enter routing number"
            />

            <CheckCapture value={check} onChange={setCheck} />

            <div className="wjFormGroup">
                <label>Preferred Schedule</label>
                <div className="wjRadioGroup">
                    {scheduleOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={`wjRadioOption ${schedule === opt.value ? 'selected' : ''}`}
                            onClick={() => setSchedule(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <label className="wjAuthCheckbox">
                <input
                    type="checkbox"
                    checked={authorized}
                    onChange={(e) => setAuthorized(e.target.checked)}
                />
                <span>
                    Member authorizes debits to be initiated per the agreed Contribution Plan schedule.
                    This authority is to remain in effect until the specified end date or until
                    Anjuman-e-Burhani (Austin), Inc. receives written termination, whichever is earlier.
                    Written notification must be received in such time and such manner as to afford
                    Anjuman-e-Burhani (Austin), Inc. 10 business days to act on it.
                </span>
            </label>

            <SignaturePad value={signature} onChange={setSignature} />

            <div className="wjStepActions">
                {onBack && (
                    <button className="wjBtnSecondary" onClick={onBack}>
                        Back
                    </button>
                )}
                {onDefer && (
                    <button className="wjBtnSecondary" onClick={onDefer} disabled={submitting}>
                        Defer
                    </button>
                )}
                <button className="wjBtnPrimary" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Next'}
                </button>
            </div>

            {showIncomplete && (
                <div className="wjModal" onClick={() => setShowIncomplete(false)}>
                    <div className="wjModalContent" onClick={(e) => e.stopPropagation()}>
                        <h3>ACH Information Incomplete</h3>
                        <p>Please provide all fields on this page before continuing.</p>
                        <div className="wjModalActions">
                            <button className="wjBtnPrimary" onClick={() => setShowIncomplete(false)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Open Pledges Step ──

function OpenPledgesStep({ hofIts, onConfirm, onBack }) {
    const { data, loading } = useQuery(GET_MY_OPEN_BALANCES, {
        variables: { hofIts },
    });

    const balances = (data?.getMyOpenBalances || []).filter((b) => !b.pp);

    return (
        <div className="wjStep">
            <h2 className="wjStepTitle"><span style={{ color: 'var(--color-gold)' }}>Open Pledges</span></h2>
            <p className="wjStepDesc">
                Please make sure open pledges are cleared or have a payment plan
            </p>

            {loading ? (
                <p>Loading…</p>
            ) : balances.length === 0 ? (
                <p className="wjNoData">No open pledges.</p>
            ) : (
                <div className="wjTableWrapper">
                    <table className="wjTable">
                        <thead>
                            <tr>
                                <th>Pledge</th>
                                <th>Balance</th>
                                <th>Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            {balances.map((b) => (
                                <tr key={b._id}>
                                    <td>{b.qb_id}</td>
                                    <td>{formatCurrency(b.balance)}</td>
                                    <td>{b.due || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="wjStepActions">
                {onBack && (
                    <button className="wjBtnSecondary" onClick={onBack}>
                        Back
                    </button>
                )}
                <a
                    href="https://www.billandpay.com/web/login.php?m=17357"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wjBtnPrimary"
                    style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                    Adaa
                </a>
                <button className="wjBtnSecondary" onClick={onConfirm}>
                    Defer
                </button>
            </div>
        </div>
    );
}

// ── Slot Scheduler ──

function SlotScheduler({ onBook, onBack, onRestart, hostingMiqaats }) {
    const { data, loading } = useQuery(GET_AVAILABLE_SLOTS);
    const [pageStart, setPageStart] = useState(0);
    const [confirmSlot, setConfirmSlot] = useState(null);
    const slots = data?.getAvailableSlots || [];

    const GROUP_ORDER = ['After Zohr Asr', 'Before Maghrib Isha', 'After Maghrib Isha'];

    const slotsByDate = {};
    slots.forEach((slot) => {
        const dateKey = slot.date.split('T')[0];
        if (!slotsByDate[dateKey]) slotsByDate[dateKey] = {};
        const group = slot.group || 'Other';
        if (!slotsByDate[dateKey][group]) slotsByDate[dateKey][group] = [];
        slotsByDate[dateKey][group].push(slot);
    });

    const dateKeys = Object.keys(slotsByDate).sort();
    const visibleDates = dateKeys.slice(pageStart, pageStart + 5);

    const canPrev = pageStart > 0;
    const canNext = pageStart + 5 < dateKeys.length;

    if (loading) return <p>Loading available slots…</p>;

    if (dateKeys.length === 0) {
        return (
            <div className="wjStep">
                <h2 className="wjStepTitle">Schedule Your Appointment</h2>
                {onBack && (
                    <div className="wjStepActions" style={{ justifyContent: 'flex-start', marginTop: 0, marginBottom: 16 }}>
                        <button className="wjBtnSecondary" onClick={onBack}>
                            Back
                        </button>
                    </div>
                )}
                <p className="wjNoData">No available slots at this time.</p>
                {onRestart && (
                    <div className="wjUpdateNiyyatWrap">
                        <button className="wjBtnUpdateNiyyat" onClick={onRestart}>
                            Update Niyyat
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="wjStep">
            <h2 className="wjStepTitle">Schedule Your Appointment</h2>

            {onBack && (
                <div className="wjStepActions" style={{ justifyContent: 'flex-start', marginTop: 0, marginBottom: 16 }}>
                    <button className="wjBtnSecondary" onClick={onBack}>
                        Back
                    </button>
                </div>
            )}

            {hostingMiqaats && hostingMiqaats.length > 0 && (
                <div className="wjNiyaazInfo">
                    You are hosting Niyaaz on{' '}
                    <strong>{formatDate(hostingMiqaats[0].date)}</strong>
                    {hostingMiqaats.length > 1 && (
                        <> and <strong>{formatDate(hostingMiqaats[1].date)}</strong></>
                    )}
                </div>
            )}

            <div className="wjCarouselNav">
                <button
                    className="wjCarouselBtn"
                    onClick={() => setPageStart(Math.max(0, pageStart - 5))}
                    disabled={!canPrev}
                >
                    Previous
                </button>
                <button
                    className="wjCarouselBtn"
                    onClick={() => setPageStart(pageStart + 5)}
                    disabled={!canNext}
                >
                    More
                </button>
            </div>

            <div className="wjSlotCards">
                {visibleDates.map((dateKey) => {
                    const groupsForDate = slotsByDate[dateKey];
                    const sortedGroups = Object.keys(groupsForDate).sort(
                        (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)
                    );
                    return (
                        <div key={dateKey} className="wjSlotCard">
                            <h3 className="wjSlotCardDate">{formatDate(dateKey)}</h3>
                            {sortedGroups.map((group) => (
                                <div key={group} className="wjSlotGroup">
                                    <div className="wjSlotGroupLabel">{group}</div>
                                    <div className="wjSlotButtons">
                                        {groupsForDate[group].map((slot) => (
                                            <button
                                                key={slot._id}
                                                className="wjSlotBtn"
                                                onClick={() => setConfirmSlot(slot)}
                                            >
                                                {formatTime12(slot.startTime)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            {onRestart && (
                <div className="wjUpdateNiyyatWrap">
                    <button className="wjBtnPrimary" onClick={onRestart}>
                        Update Niyyat
                    </button>
                </div>
            )}

            {confirmSlot && (
                <div className="wjModal">
                    <div className="wjModalContent">
                        <h3>Confirm Appointment</h3>
                        <p style={{ fontSize: '1.3em' }}>
                            {formatDate(confirmSlot.date)} at {formatTime12(confirmSlot.startTime)}
                        </p>
                        <div className="wjModalActions">
                            <button className="wjBtnSecondary" onClick={() => setConfirmSlot(null)}>
                                Cancel
                            </button>
                            <button className="wjBtnPrimary" onClick={() => onBook(confirmSlot._id)}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Booking Confirmation ──

function BookingConfirmation({ slot, commitment, fmbPledgeAmount, user, onCancel, cancelling }) {
    const [emailAppointment] = useMutation(EMAIL_APPOINTMENT);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailInput, setEmailInput] = useState('');

    const handleSendEmail = () => {
        const emails = emailInput.trim();
        setShowEmailModal(false);
        setEmailInput('');
        if (!emails) return;
        // Fail silently on invalid emails or send failures.
        emailAppointment({ variables: { emails } }).catch(() => {});
    };
    const krDisplay = commitment?.kr > 0 ? formatCurrency(commitment.kr) : 'Pending';
    const utDisplay = commitment?.ut > 0 ? formatCurrency(commitment.ut) : 'Pending';
    const fmbDisplay = fmbPledgeAmount != null ? formatCurrency(fmbPledgeAmount) : 'Pending';

    return (
        <div className="wjStep">
            <h2 className="wjStepTitle">Your Appointment</h2>
            <div className="wjBookingDetails">
                <div className="wjBookingDateTime">{formatDate(slot.date)} at {formatTime12(slot.startTime)}</div>
            </div>

            <div className="wjUserInfo">
                <h3>{user?.userFullName}</h3>
                <p>ITS: {user?.memberIts}</p>
                <p>Mohalla: {user?.userZone}</p>
            </div>

            <div className="wjCommitmentSummary">
                <h3 className="wjStepTitle">Niyyats</h3>
                <div className="wjSummaryRow">
                    <span>Khidmat Ramadaniyah</span>
                    <span className={krDisplay === 'Pending' ? 'wjPending' : ''}>{krDisplay}</span>
                </div>
                <div className="wjSummaryRow">
                    <span>Umoor Taalimiyah</span>
                    <span className={utDisplay === 'Pending' ? 'wjPending' : ''}>{utDisplay}</span>
                </div>
                {fmbDisplay === 'Pending' && (
                    <div className="wjSummaryRow">
                        <span>FMB</span>
                        <span className="wjPending">{fmbDisplay}</span>
                    </div>
                )}
            </div>

            <div className="wjChecklist">
                <h3 className="wjStepTitle">Before Your Appointment</h3>
                <ul>
                    {CHECKLIST_ITEMS.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            </div>

            <div className="wjCancelAction">
                <button className="wjBtnPrimary" onClick={() => setShowEmailModal(true)}>
                    Email
                </button>
                <button className="wjBtnCancel" onClick={onCancel} disabled={cancelling}>
                    {cancelling ? 'Cancelling…' : 'Cancel'}
                </button>
            </div>

            {showEmailModal && (
                <div className="wjModal">
                    <div className="wjModalContent">
                        <h3>Email Appointment</h3>
                        <p style={{ marginTop: 0 }}>Enter email addresses, separated by commas.</p>
                        <div className="wjFormGroup">
                            <input
                                type="text"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                placeholder="name@example.com, other@example.com"
                                autoFocus
                            />
                        </div>
                        <div className="wjModalActions">
                            <button
                                className="wjBtnSecondary"
                                onClick={() => { setShowEmailModal(false); setEmailInput(''); }}
                            >
                                Cancel
                            </button>
                            <button className="wjBtnPrimary" onClick={handleSendEmail}>
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Wajebaat Page ──

export default function Wajebaat() {
    const hasAccess = Auth.isMaaliyaVolunteer();
    const { data: meData } = useQuery(GET_ME);
    const { data: statusData, loading: statusLoading, refetch: refetchStatus } = useQuery(
        GET_MY_WAJEBAAT_STATUS,
        { skip: !hasAccess }
    );

    const [stepHistory, setStepHistory] = useState([STEP_INTRO]);
    const [krAmount, setKrAmount] = useState('');
    const [utAmount, setUtAmount] = useState('');
    const [error, setError] = useState('');

    const [submitCommitments, { loading: committing }] = useMutation(SUBMIT_COMMITMENTS);
    const [submitACH, { loading: achSubmitting }] = useMutation(SUBMIT_ACH);
    const [deferACH] = useMutation(DEFER_ACH);
    const [bookSlot, { loading: booking }] = useMutation(BOOK_SLOT);
    const [cancelMySlot, { loading: cancelling }] = useMutation(CANCEL_MY_SLOT);

    const currentStep = stepHistory[stepHistory.length - 1];
    const canGoBack = stepHistory.length > 1;
    const goToStep = (step) => setStepHistory((prev) => [...prev, step]);
    const goBack = () => setStepHistory((prev) => prev.length > 1 ? prev.slice(0, -1) : prev);
    // Restart the commitments flow from the top, keeping already-saved values prefilled.
    const handleRestart = () => setStepHistory([STEP_KR]);

    const status = statusData?.getMyWajebaatStatus;
    const hofIts = meData?.me?.memberHof;

    // Prefill commitment fields once from any previously-saved commitment so a
    // returning user (or one who hits Restart) can review and edit their values.
    const prefilledRef = useRef(false);
    useEffect(() => {
        const commitment = status?.commitment;
        if (!commitment || prefilledRef.current) return;
        prefilledRef.current = true;
        // A null amount means it was deferred; leave that field empty.
        if (commitment.kr != null) setKrAmount(String(commitment.kr));
        if (commitment.ut != null) setUtAmount(String(commitment.ut));
    }, [status]);

    const { data: balancesData } = useQuery(GET_MY_OPEN_BALANCES, {
        variables: { hofIts: hofIts || '' },
        skip: !hofIts,
    });
    const openBalances = (balancesData?.getMyOpenBalances || []).filter((b) => !b.pp);
    const hasOpenPledges = openBalances.length > 0;

    if (!hasAccess) {
        return (
            <>
                <Nav />
                <div className="pageContainer">
                    <div className="letterHeader">
                        <h1>Wajebaat</h1>
                    </div>
                    <div
                        className="laagatWarning"
                        style={{
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            fontSize: '18px',
                            maxWidth: '560px',
                            margin: '0 auto',
                        }}
                    >
                        <span>The Wajebaat module will be live in Rajab ul Asab 1448H</span>
                    </div>
                </div>
            </>
        );
    }

    if (statusLoading) {
        return (
            <>
                <Nav />
                <div className="pageContainer"><p>Loading…</p></div>
            </>
        );
    }

    const hasCommitment = !!status?.commitment;
    const hasACH = !!status?.ach;
    const hasBookedSlot = !!status?.bookedSlot;

    const handleCommitmentSubmit = async (utIsDeferred) => {
        setError('');
        try {
            await submitCommitments({
                variables: {
                    // An empty amount means the cause was deferred → send null.
                    kr: krAmount ? parseFloat(krAmount) : null,
                    ut: utIsDeferred ? null : parseFloat(utAmount),
                    year: '1448-49',
                },
            });
            // Always show the ACH step — it's an upsert, so re-submitting (or
            // deferring) on restart is fine and lets the user update their details.
            goToStep(STEP_ACH);
            refetchStatus();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleACHSubmit = async ({ accountNumber, routingNumber, schedule, authorized, check, signature }) => {
        setError('');
        try {
            await submitACH({
                variables: { accountNumber, routingNumber, schedule, authorized, check, signature },
            });
            goToStep(hasOpenPledges ? STEP_PLEDGES : STEP_SCHEDULER);
            refetchStatus();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleACHDefer = async () => {
        setError('');
        try {
            // Persist a blank ACH so the user isn't asked again on reload.
            await deferACH();
            goToStep(hasOpenPledges ? STEP_PLEDGES : STEP_SCHEDULER);
            refetchStatus();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleBookSlot = async (slotId) => {
        setError('');
        try {
            await bookSlot({ variables: { slotId } });
            refetchStatus();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleCancelSlot = async () => {
        setError('');
        try {
            await cancelMySlot();
            refetchStatus();
        } catch (err) {
            setError(err.message);
        }
    };

    const determineInitialStep = () => {
        if (hasBookedSlot) return 'BOOKED';
        if (hasCommitment && hasACH) return STEP_SCHEDULER;
        if (hasCommitment) return STEP_ACH;
        return null;
    };

    const resumeState = determineInitialStep();

    const renderContent = () => {
        if (resumeState === 'BOOKED') {
            return (
                <BookingConfirmation
                    slot={status.bookedSlot}
                    commitment={status.commitment}
                    fmbPledgeAmount={status.fmbPledgeAmount}
                    user={meData?.me}
                    onCancel={handleCancelSlot}
                    cancelling={cancelling}
                />
            );
        }

        if (resumeState === STEP_SCHEDULER && currentStep === STEP_INTRO) {
            return <SlotScheduler onBook={handleBookSlot} onRestart={handleRestart} hostingMiqaats={status?.hostingMiqaats} />;
        }

        if (resumeState === STEP_ACH && currentStep === STEP_INTRO) {
            return <ACHStep onSubmit={handleACHSubmit} onDefer={handleACHDefer} submitting={achSubmitting} existingACH={status?.ach} existingSchedule={status?.commitment?.schedule} />;
        }

        switch (currentStep) {
            case STEP_INTRO:
                return <IntroStep onNext={() => goToStep(STEP_KR)} />;
            case STEP_KR:
                return (
                    <CommitmentStep
                        key={STEP_KR}
                        title={<span style={{ color: 'var(--color-gold)' }}>Khidmat Ramadaniyah</span>}
                        amount={krAmount}
                        onAmountChange={setKrAmount}
                        onBack={canGoBack ? goBack : undefined}
                        onDefer={() => { setKrAmount(''); goToStep(STEP_UT); }}
                        onNext={() => goToStep(STEP_UT)}
                        lastYearAmount={status?.lastYearCommitment?.kr}
                        items={KR_ITEMS}
                        unitHint="Please consider units of $353 | $553 | $786 | $1100 to help us reach our collective goal"
                    />
                );
            case STEP_UT:
                return (
                    <CommitmentStep
                        key={STEP_UT}
                        title={<span style={{ color: 'var(--color-gold)' }}>Umoor Taalimiyah</span>}
                        amount={utAmount}
                        onAmountChange={setUtAmount}
                        onBack={canGoBack ? goBack : undefined}
                        onDefer={() => { setUtAmount(''); handleCommitmentSubmit(true); }}
                        onNext={() => handleCommitmentSubmit(false)}
                        lastYearAmount={status?.lastYearCommitment?.ut}
                        items={UT_ITEMS}
                        minAmount={72}
                        unitHint="Please consider units of $72 | $153 | $253 to help us reach our collective goal"
                    />
                );
            case STEP_ACH:
                return <ACHStep onSubmit={handleACHSubmit} onBack={canGoBack ? goBack : undefined} onDefer={handleACHDefer} submitting={achSubmitting} existingACH={status?.ach} existingSchedule={status?.commitment?.schedule} />;
            case STEP_PLEDGES:
                return (
                    <OpenPledgesStep
                        hofIts={hofIts}
                        onBack={canGoBack ? goBack : undefined}
                        onConfirm={() => goToStep(STEP_SCHEDULER)}
                    />
                );
            case STEP_SCHEDULER:
                return <SlotScheduler onBook={handleBookSlot} onRestart={handleRestart} hostingMiqaats={status?.hostingMiqaats} />;
            default:
                return null;
        }
    };

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="wjHeader">
                    <h1>Wajebaat</h1>
                </div>

                {error && <p className="wjError">{error}</p>}

                <div className="wjContent">
                    {renderContent()}
                </div>
            </div>
        </>
    );
}
