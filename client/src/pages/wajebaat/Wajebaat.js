import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import Auth from '../../utils/auth';
import { GET_MY_WAJEBAAT_STATUS, GET_AVAILABLE_SLOTS } from './gql/queries';
import { SUBMIT_COMMITMENTS, SUBMIT_ACH, BOOK_SLOT, CANCEL_MY_SLOT } from './gql/mutations';
import { GET_MY_OPEN_BALANCES } from '../openBalances/gql/queries';
import { GET_ME } from '../user/gql/queries';

const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

const CHECKLIST_ITEMS = [
    'Wuzu',
    'Remind your family to attend with you',
    'Wajebaat Check',
    'Sila Fitra Check',
    'Voided Check',
    'Printout of this page',
];

// ── Intro Step ──

function IntroStep({ onNext }) {
    return (
        <div className="wjStep">
            <p className="wjStepDesc">
                The system will guide you through the prerequisites for your Waajebaat. Please contact a member from Umoor Maaliyah if you have any questions.
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

function CommitmentStep({ title, description, amount, onAmountChange, onDefer, onNext, deferred, lastYearAmount, minAmount = 353, unitHint }) {
    const parsedAmount = amount ? parseFloat(amount) : 0;
    const belowMin = minAmount > 0 && amount && parsedAmount < minAmount;
    const isValid = deferred || (amount && parsedAmount > 0 && (!minAmount || parsedAmount >= minAmount));
    const [showHint, setShowHint] = useState(false);

    useEffect(() => {
        setShowHint(false);
        if (!amount || !belowMin) return;
        const timer = setTimeout(() => setShowHint(true), 3000);
        return () => clearTimeout(timer);
    }, [amount, belowMin]);

    return (
        <div className="wjStep">
            <h2 className="wjStepTitle">{title}</h2>
            <p className="wjStepDesc">{description}</p>

            {lastYearAmount != null && (
                <div className="wjLastYear">
                    Last year, you committed ${Math.round(lastYearAmount)} towards this cause
                </div>
            )}

            {deferred ? (
                <div className="wjDeferred">
                    <p>Deferred</p>
                    <button className="wjBtnSecondary" onClick={() => onDefer(false)}>
                        Enter Amount Instead
                    </button>
                </div>
            ) : (
                <>
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
                    {showHint && unitHint && <p className="wjUnitHint">{unitHint}</p>}
                </>
            )}

            <div className="wjStepActions">
                {!deferred && (
                    <button className="wjBtnSecondary" onClick={() => onDefer(true)}>
                        Defer
                    </button>
                )}
                <button className="wjBtnPrimary" onClick={onNext} disabled={!isValid}>
                    Next
                </button>
            </div>
        </div>
    );
}

// ── ACH Step ──

function ACHStep({ onSubmit, submitting }) {
    const [accountNumber, setAccountNumber] = useState('');
    const [routingNumber, setRoutingNumber] = useState('');
    const [schedule, setSchedule] = useState('');

    const isValid = accountNumber.length >= 8 && routingNumber.length >= 9 && schedule;

    const handleSubmit = () => {
        onSubmit({ accountNumber, routingNumber, schedule });
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

            <div className="wjStepActions">
                <button className="wjBtnPrimary" onClick={handleSubmit} disabled={!isValid || submitting}>
                    {submitting ? 'Submitting…' : 'Next'}
                </button>
            </div>
        </div>
    );
}

// ── Open Pledges Step ──

function OpenPledgesStep({ hofIts, onConfirm }) {
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

function SlotScheduler({ onBook, hostingMiqaats }) {
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
                <p className="wjNoData">No available slots at this time.</p>
            </div>
        );
    }

    return (
        <div className="wjStep">
            <h2 className="wjStepTitle">Schedule Your Appointment</h2>

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
    const printRef = useRef();
    const krDisplay = commitment?.kr > 0 ? formatCurrency(commitment.kr) : 'Pending';
    const utDisplay = commitment?.ut > 0 ? formatCurrency(commitment.ut) : 'Pending';
    const fmbDisplay = fmbPledgeAmount != null ? formatCurrency(fmbPledgeAmount) : 'Pending';

    const handlePrint = () => {
        const content = printRef.current;
        const win = window.open('', '_blank');
        win.document.write('<html><head><title>Wajebaat Appointment</title>');
        win.document.write('<link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet">');
        win.document.write('<style>');
        win.document.write('body { font-family: "PT Sans", sans-serif; padding: 32px; }');
        win.document.write('h2, h3 { font-family: "Merriweather", serif; color: #00203D; }');
        win.document.write('.wjBookingDetails { text-align: center; padding: 20px; background: #f5f5f5; border-radius: 10px; margin-bottom: 24px; }');
        win.document.write('.wjBookingDateTime { font-size: 20px; font-weight: bold; color: #CE9C01; }');
        win.document.write('.wjUserInfo { margin-bottom: 24px; }');
        win.document.write('.wjUserInfo h3 { margin: 0 0 4px 0; font-size: 20px; }');
        win.document.write('.wjUserInfo p { margin: 0; color: #555; font-size: 14px; }');
        win.document.write('.wjSummaryRow { display: flex; justify-content: space-between; padding: 10px 14px; background: #f5f5f5; border-radius: 6px; margin-bottom: 8px; }');
        win.document.write('.wjSummaryRow span:last-child { font-weight: bold; }');
        win.document.write('.wjPending { text-transform: uppercase; }');
        win.document.write('.wjChecklist li { padding: 8px 0; border-bottom: 1px solid #eee; }');
        win.document.write('.wjChecklist ul { list-style: none; padding: 0; }');
        win.document.write('.wjChecklist li::before { content: "\\2610"; margin-right: 10px; font-size: 18px; }');
        win.document.write('.wjCancelAction { display: none; }');
        win.document.write('</style></head><body>');
        win.document.write(content.innerHTML);
        win.document.write('</body></html>');
        win.document.close();
        win.print();
    };

    return (
        <div className="wjStep" ref={printRef}>
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
                <h3 className="wjStepTitle">Commitments</h3>
                <div className="wjSummaryRow">
                    <span>Khidmat Ramadaniyah</span>
                    <span className={krDisplay === 'Pending' ? 'wjPending' : ''}>{krDisplay}</span>
                </div>
                <div className="wjSummaryRow">
                    <span>Umoor Taalimiyah</span>
                    <span className={utDisplay === 'Pending' ? 'wjPending' : ''}>{utDisplay}</span>
                </div>
                <div className="wjSummaryRow">
                    <span>FMB</span>
                    <span className={fmbDisplay === 'Pending' ? 'wjPending' : ''}>{fmbDisplay}</span>
                </div>
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
                <button className="wjBtnPrimary" onClick={handlePrint}>
                    Print
                </button>
                <button className="wjBtnCancel" onClick={onCancel} disabled={cancelling}>
                    {cancelling ? 'Cancelling…' : 'Cancel'}
                </button>
            </div>
        </div>
    );
}

// ── Main Wajebaat Page ──

export default function Wajebaat() {
    const isLetterAdmin = Auth.isLetterAdmin();
    const { data: meData } = useQuery(GET_ME);
    const { data: statusData, loading: statusLoading, refetch: refetchStatus } = useQuery(
        GET_MY_WAJEBAAT_STATUS,
        { skip: !isLetterAdmin }
    );

    const [stepHistory, setStepHistory] = useState([STEP_INTRO]);
    const [krAmount, setKrAmount] = useState('');
    const [utAmount, setUtAmount] = useState('');
    const [krDeferred, setKrDeferred] = useState(false);
    const [utDeferred, setUtDeferred] = useState(false);
    const [error, setError] = useState('');

    const [submitCommitments, { loading: committing }] = useMutation(SUBMIT_COMMITMENTS);
    const [submitACH, { loading: achSubmitting }] = useMutation(SUBMIT_ACH);
    const [bookSlot, { loading: booking }] = useMutation(BOOK_SLOT);
    const [cancelMySlot, { loading: cancelling }] = useMutation(CANCEL_MY_SLOT);

    const currentStep = stepHistory[stepHistory.length - 1];
    const goToStep = (step) => setStepHistory((prev) => [...prev, step]);

    const status = statusData?.getMyWajebaatStatus;
    const hofIts = meData?.me?.memberHof;

    const { data: balancesData } = useQuery(GET_MY_OPEN_BALANCES, {
        variables: { hofIts: hofIts || '' },
        skip: !hofIts,
    });
    const openBalances = (balancesData?.getMyOpenBalances || []).filter((b) => !b.pp);
    const hasOpenPledges = openBalances.length > 0;

    if (!isLetterAdmin) {
        return (
            <>
                <Nav />
                <div className="pageContainer">
                    <div className="letterHeader">
                        <h1>Waajebaat</h1>
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
                        <span>The Waajebaat module will be live in Rajab ul Asab 1448H</span>
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

    const handleCommitmentSubmit = async () => {
        setError('');
        try {
            await submitCommitments({
                variables: {
                    kr: krDeferred ? null : parseFloat(krAmount),
                    ut: utDeferred ? null : parseFloat(utAmount),
                    year: '1448-49',
                },
            });
            goToStep(STEP_ACH);
            refetchStatus();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleACHSubmit = async ({ accountNumber, routingNumber, schedule }) => {
        setError('');
        try {
            await submitACH({
                variables: { accountNumber, routingNumber, schedule },
            });
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
            return <SlotScheduler onBook={handleBookSlot} hostingMiqaats={status?.hostingMiqaats} />;
        }

        if (resumeState === STEP_ACH && currentStep === STEP_INTRO) {
            return <ACHStep onSubmit={handleACHSubmit} submitting={achSubmitting} />;
        }

        switch (currentStep) {
            case STEP_INTRO:
                return <IntroStep onNext={() => goToStep(STEP_KR)} />;
            case STEP_KR:
                return (
                    <CommitmentStep
                        title={<span style={{ color: 'var(--color-gold)' }}>Khidmat Ramadaniyah</span>}
                        description="This amount goes towards various Khidmats that Austin Jamaat collectively does during Shehrullah il Moazzam. This includes Lailatul Qadr niyaaz and sihori here in Austin, Niyaaz and Ziafat in Hazrat Aaliyah, Hajj e Badal to support Hajj volunteers and Marafiq Burhaniyah (Upliftment and financial aid in Austin)"
                        amount={krAmount}
                        onAmountChange={setKrAmount}
                        deferred={krDeferred}
                        onDefer={setKrDeferred}
                        onNext={() => goToStep(STEP_UT)}
                        lastYearAmount={status?.lastYearCommitment?.kr}
                        unitHint="Please consider units of $353 | $553 | $786 | $1100 to help us reach our collective goal"
                    />
                );
            case STEP_UT:
                return (
                    <CommitmentStep
                        title={<span style={{ color: 'var(--color-gold)' }}>Umoor Taalimiyah</span>}
                        description="Majority of our Taalim operations are supported through student fees. Your additional contributions will help drive larger projects across both Raudat al Quran and Madrasah tul Badri and will collectively benefit our next generation"
                        amount={utAmount}
                        onAmountChange={setUtAmount}
                        deferred={utDeferred}
                        onDefer={setUtDeferred}
                        onNext={handleCommitmentSubmit}
                        lastYearAmount={status?.lastYearCommitment?.ut}
                        minAmount={72}
                        unitHint="Please consider units of $72 | $153 | $253 to help us reach our collective goal"
                    />
                );
            case STEP_ACH:
                return <ACHStep onSubmit={handleACHSubmit} submitting={achSubmitting} />;
            case STEP_PLEDGES:
                return (
                    <OpenPledgesStep
                        hofIts={hofIts}
                        onConfirm={() => goToStep(STEP_SCHEDULER)}
                    />
                );
            case STEP_SCHEDULER:
                return <SlotScheduler onBook={handleBookSlot} hostingMiqaats={status?.hostingMiqaats} />;
            default:
                return null;
        }
    };

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="wjHeader">
                    <h1>Waajebaat</h1>
                </div>

                {error && <p className="wjError">{error}</p>}

                <div className="wjContent">
                    {renderContent()}
                </div>
            </div>
        </>
    );
}
