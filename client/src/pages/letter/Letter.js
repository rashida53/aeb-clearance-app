import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import Nav from '../../components/Nav';
import LetterPdfDocument from './LetterPdfDocument';
import { GET_ME } from '../user/gql/queries';
import { GET_MY_QB_OPENS, GET_APPROVAL_STATUS } from '../openBalances/gql/queries';
import { GENERATE_LETTER } from './gql/mutations';

const REASONS = ['Personal Function', 'Travel', 'Life Event', '12 Umoor'];

const SUB_OPTIONS = {
    'Personal Function': ['Markaz', 'Outside Markaz'],
    'Life Event': ['Aqiqa', 'Chhatti', 'Misaaq', 'Nikaah'],
    'Travel': ['Hajj', 'Umrah', 'Kun', 'Misr', 'India'],
    '12 Umoor': ['Iqtesadiyah - Qardan Hasanah', 'Marafiq Burhaniyah - Moasaat', 'FMB - Niyaaz/Thaali'],
};

const FMB_OPTIONS = ['Item in Thaali', 'Full Thaali', 'Item in Niyaaz'];
const EVENT_TYPE_OPTIONS = ['Darees', 'Majlis', 'Tasbeeh', 'Shitabi'];

const STEP_REASON = 'reason';
const STEP_SUB_OPTION = 'sub_option';
const STEP_LAAGAT = 'laagat';
const STEP_LAAGAT_LIFE = 'laagat_life';
const STEP_EVENT_TYPE = 'event_type';
const STEP_FMB = 'fmb';
const STEP_DESCRIPTION = 'description';

const LAAGAT_AMOUNTS_MARKAZ = {
    'Darees': 110,
    'Majlis': 72,
    'Tasbeeh': 72,
    'Shitabi': 110,
};

const LAAGAT_LIFE_AMOUNTS = {
    'Aqiqa':  { sarkaari: 72,  jamaat: 72  },
    'Misaaq': { sarkaari: 110, jamaat: 110 },
    'Nikaah': { sarkaari: 353, jamaat: 353 },
};

const STEP_LABELS = {
    [STEP_REASON]: 'Reason',
    [STEP_SUB_OPTION]: 'Category',
    [STEP_LAAGAT]: 'Laagat',
    [STEP_LAAGAT_LIFE]: 'Laagat',
    [STEP_EVENT_TYPE]: 'Event Type',
    [STEP_FMB]: 'FMB Type',
    [STEP_DESCRIPTION]: 'Description',
};

export default function Letter() {
    const [stepHistory, setStepHistory] = useState([STEP_REASON]);
    const [selections, setSelections] = useState({
        reason: '',
        subOption: '',
        eventType: '',
        fmbOption: '',
        description: '',
        date: '',
        laagatAmount: null,
        sarkaariLaagat: null,
        jamaatLaagat: null,
    });
    const [laagatOpen, setLaagatOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const navigate = useNavigate();

    const { data: meData, loading: meLoading } = useQuery(GET_ME);
    const hofIts = meData?.me?.memberHof || '';
    const userId = meData?.me?.userId || '';
    const hofName = meData?.me?.memberFullName || meData?.me?.userFullName || '';

    const { data: qbOpensData, loading: qbLoading } = useQuery(GET_MY_QB_OPENS, {
        variables: { userId },
        skip: !userId,
    });
    const { data: approvalData, loading: approvalLoading } = useQuery(GET_APPROVAL_STATUS, {
        variables: { hofIts, userId },
        skip: !hofIts || !userId,
    });

    const openBalances = qbOpensData?.getMyQbOpens || [];
    const approved = approvalData?.getApprovalStatus?.approved === true;
    const approvalRemarks = approvalData?.getApprovalStatus?.remarks || '';
    const approverName = approvalData?.getApprovalStatus?.approverName || '';
    const [generateLetter] = useMutation(GENERATE_LETTER);
    const dataReady = !meLoading && !qbLoading && !approvalLoading && !!userId;

    const currentStep = stepHistory[stepHistory.length - 1];

    const goToStep = (step) => setStepHistory(prev => [...prev, step]);
    const goBack = () => setStepHistory(prev => prev.slice(0, -1));

    const handleReasonSelect = (reason) => {
        setSelections({ reason, subOption: '', eventType: '', fmbOption: '', description: '', date: '', laagatAmount: null, sarkaariLaagat: null, jamaatLaagat: null });
        goToStep(STEP_SUB_OPTION);
    };

    const handleSubOptionSelect = (option) => {
        setSelections(prev => ({ ...prev, subOption: option, eventType: '', fmbOption: '', laagatAmount: null, sarkaariLaagat: null, jamaatLaagat: null }));
        if (option === 'Markaz') {
            goToStep(STEP_LAAGAT);
        } else if (['Aqiqa', 'Misaaq', 'Nikaah'].includes(option)) {
            goToStep(STEP_LAAGAT_LIFE);
        } else if (selections.reason === 'Personal Function') {
            goToStep(STEP_EVENT_TYPE);
        } else if (selections.reason === '12 Umoor' && option === 'FMB') {
            goToStep(STEP_FMB);
        } else {
            goToStep(STEP_DESCRIPTION);
        }
    };

    const handleLaagatAgree = () => {
        goToStep(STEP_EVENT_TYPE);
    };

    const handleLaagatLifeAgree = () => {
        const amounts = LAAGAT_LIFE_AMOUNTS[selections.subOption] || {};
        setSelections(prev => ({ ...prev, sarkaariLaagat: amounts.sarkaari, jamaatLaagat: amounts.jamaat }));
        goToStep(STEP_DESCRIPTION);
    };

    const handleEventTypeSelect = (option) => {
        const laagatAmount = selections.subOption === 'Markaz' ? (LAAGAT_AMOUNTS_MARKAZ[option] || 72) : null;
        setSelections(prev => ({ ...prev, eventType: option, laagatAmount }));
        goToStep(STEP_DESCRIPTION);
    };

    const handleFmbOptionSelect = (option) => {
        setSelections(prev => ({ ...prev, fmbOption: option }));
        goToStep(STEP_DESCRIPTION);
    };

    const leafReason = selections.fmbOption || selections.eventType || selections.subOption || selections.reason;

    const showLaagat = ['Markaz', 'Aqiqa', 'Misaaq', 'Nikaah'].includes(selections.subOption);

    const handleGenerate = async () => {
        setGenerating(true);
        const blob = await pdf(
            <LetterPdfDocument
                hofIts={hofIts}
                hofName={hofName}
                reason={leafReason}
                description={selections.description}
                date={selections.date || null}
                showLaagat={showLaagat}
                laagatAmount={selections.laagatAmount}
                sarkaariLaagat={selections.sarkaariLaagat}
                jamaatLaagat={selections.jamaatLaagat}
                openBalances={openBalances}
                approved={approved}
                approvalRemarks={approvalRemarks}
                approverName={approverName}
            />
        ).toBlob();

        try {
            await generateLetter({
                variables: {
                    hofIts,
                    hofName,
                    reason: leafReason,
                    description: selections.description || '',
                },
            });
        } catch (err) {
            console.error('Failed to log letter:', err.message);
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Clearance-${hofIts || 'draft'}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        setGenerating(false);
        setTimeout(() => navigate('/'), 500);
    };

    const getSubOptionQuestion = () => {
        if (selections.reason === 'Personal Function') return 'Event Venue';
        if (selections.reason === 'Travel') return 'Travel Destination';
        if (selections.reason === '12 Umoor') return 'Choose Umoor';
        return 'Select an option';
    };

    return (
        <>
            <Nav />
            <div className="pageContainer">
                {dataReady && openBalances.length > 0 && !approved && (
                    <div className="letterPledgeWarning">
                        Please contact <strong>M Taaha bhai Bhora</strong> or <strong>Shk Murtaza bhai Rawat</strong> regarding your open pledges before generating your letter.
                    </div>
                )}

                <div className="letterHeader">
                    <h1>Safaai Chitthi</h1>
                </div>

                <div className="letterForm">
                    {currentStep === STEP_REASON && (
                        <div className="letterStep">
                            <h3 className="letterQuestion">Reason</h3>
                            <div className="letterOptions">
                                {REASONS.map(reason => (
                                    <button
                                        key={reason}
                                        className="letterOptionBtn"
                                        onClick={() => handleReasonSelect(reason)}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === STEP_SUB_OPTION && (
                        <div className="letterStep">
                            <h3 className="letterQuestion">{getSubOptionQuestion()}</h3>
                            <div className="letterOptions">
                                {(SUB_OPTIONS[selections.reason] || []).map(option => (
                                    <button
                                        key={option}
                                        className="letterOptionBtn"
                                        onClick={() => handleSubOptionSelect(option)}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            <button className="letterBackBtn" onClick={goBack}>Back</button>
                        </div>
                    )}

                    {currentStep === STEP_LAAGAT && (
                        <div className="letterStep">
                            <div className="laagatWarning">
                                <span className="laagatWarningIcon">⚠</span>
                                <p>
                                    Events at Markaz will require a Laagat contribution. You will receive a pledge via the Bill Pay portal.
                                </p>
                            </div>

                            <button
                                className="laagatCollapsibleBtn"
                                onClick={() => setLaagatOpen(prev => !prev)}
                            >
                                <span>What is the difference between Sabeel and Laagat?</span>
                                <span className="laagatChevron">{laagatOpen ? '▲' : '▼'}</span>
                            </button>
                            {laagatOpen && (
                                <div className="laagatCollapsibleBody">
                                    Sabeel budgets are based on regular usage like Miqaats, Madrasah, FMB, etc.
                                    Laagat helps us cover usage and cleaning costs for personal events.
                                </div>
                            )}

                            <div className="laagatActions">
                                <button className="letterBackBtn" onClick={goBack}>Back</button>
                                <button className="letterGenerateBtn" onClick={handleLaagatAgree}>Agree</button>
                            </div>
                        </div>
                    )}

                    {currentStep === STEP_LAAGAT_LIFE && (() => {
                        const amounts = LAAGAT_LIFE_AMOUNTS[selections.subOption] || {};
                        return (
                        <div className="letterStep">
                            <div className="laagatWarning">
                                <span className="laagatWarningIcon">⚠</span>
                                <div>
                                    <p>It is a Nehej (tradition) for all Mumineen to araz Laagat during important life milestones to the local jamaat and Dawat-e-Hadiyah reflecting administrative expenses.</p>
                                    <ul className="laagatAmountList">
                                        <li><strong>Sarkaari Laagat:</strong> ${amounts.sarkaari}</li>
                                        <li><strong>Jamaat Laagat:</strong> ${amounts.jamaat}</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="laagatActions">
                                <button className="letterBackBtn" onClick={goBack}>Back</button>
                                <button className="letterGenerateBtn" onClick={handleLaagatLifeAgree}>Agree</button>
                            </div>
                        </div>
                        );
                    })()}

                    {currentStep === STEP_EVENT_TYPE && (
                        <div className="letterStep">
                            <h3 className="letterQuestion">Occasion</h3>
                            <div className="letterOptions">
                                {EVENT_TYPE_OPTIONS.map(option => (
                                    <button
                                        key={option}
                                        className="letterOptionBtn"
                                        onClick={() => handleEventTypeSelect(option)}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            <button className="letterBackBtn" onClick={goBack}>Back</button>
                        </div>
                    )}

                    {currentStep === STEP_FMB && (
                        <div className="letterStep">
                            <h3 className="letterQuestion">Select FMB type</h3>
                            <div className="letterOptions">
                                {FMB_OPTIONS.map(option => (
                                    <button
                                        key={option}
                                        className="letterOptionBtn"
                                        onClick={() => handleFmbOptionSelect(option)}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            <button className="letterBackBtn" onClick={goBack}>Back</button>
                        </div>
                    )}

                    {currentStep === STEP_DESCRIPTION && (
                        <div className="letterStep">
                            {selections.reason === 'Personal Function' && (
                                <div className="formGroup">
                                    <p className="letterCalendarNote">
                                        Please review the{' '}
                                        <a
                                            href="https://fmb.austinjamaat.org/events"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="letterCalendarLink"
                                        >
                                            Events Calendar
                                        </a>
                                        {' '}before picking your date
                                    </p>
                                    <h3 className="letterQuestion">Date</h3>
                                    <input
                                        type="date"
                                        className="letterDateInput"
                                        value={selections.date}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={e => setSelections(prev => ({ ...prev, date: e.target.value }))}
                                    />
                                </div>
                            )}

                            <div className="formGroup">
                                <h3 className="letterQuestion">Description</h3>
                                <textarea
                                    id="description"
                                    className="letterTextarea"
                                    value={selections.description}
                                    onChange={e => setSelections(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Details for Raza Saheb..."
                                    rows={6}
                                />
                            </div>

                            <button
                                className="letterGenerateBtn"
                                disabled={!dataReady || generating}
                                onClick={handleGenerate}
                            >
                                {!dataReady ? 'Loading...' : generating ? 'Preparing...' : 'Generate Letter'}
                            </button>

                            <button className="letterBackBtn" onClick={goBack}>Back</button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
