import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import Nav from '../../components/Nav';
import LetterPdfDocument from './LetterPdfDocument';
import { GET_ME } from '../user/gql/queries';
import { GET_MY_QB_OPENS } from '../openBalances/gql/queries';

const REASONS = ['Family Function', 'Travel', 'Life Event', '12 Umoor'];

const SUB_OPTIONS = {
    'Family Function': ['Markaz', 'Outside Markaz'],
    'Life Event': ['Aqiqa', 'Chhatti', 'Misaaq', 'Nikaah'],
    'Travel': ['Hajj', 'Umrah', 'Kun', 'Misr', 'India'],
    '12 Umoor': ['Qardan Hasanah', 'Moasaat', 'FMB'],
};

const FMB_OPTIONS = ['Item in Thaali', 'Full Thaali', 'Item in Niyaaz'];
const EVENT_TYPE_OPTIONS = ['Darees', 'Majlis', 'Tasbeeh', 'Shitabi'];

const STEP_REASON = 'reason';
const STEP_SUB_OPTION = 'sub_option';
const STEP_EVENT_TYPE = 'event_type';
const STEP_FMB = 'fmb';
const STEP_DESCRIPTION = 'description';

const STEP_LABELS = {
    [STEP_REASON]: 'Reason',
    [STEP_SUB_OPTION]: 'Category',
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
    });
    const navigate = useNavigate();

    const { data: meData, loading: meLoading } = useQuery(GET_ME);
    const hofIts = meData?.me?.memberHof || '';
    const userId = meData?.me?.userId || '';
    const hofName = meData?.me?.memberFullName || meData?.me?.userFullName || '';

    const { data: qbOpensData, loading: qbLoading } = useQuery(GET_MY_QB_OPENS, {
        variables: { userId },
        skip: !userId,
    });
    const openBalances = qbOpensData?.getMyQbOpens || [];
    const clearStatus = openBalances.length > 0 ? 'DUES_PENDING' : 'CLEAR';
    const dataReady = !meLoading && !qbLoading && !!userId;

    const currentStep = stepHistory[stepHistory.length - 1];

    const goToStep = (step) => setStepHistory(prev => [...prev, step]);
    const goBack = () => setStepHistory(prev => prev.slice(0, -1));

    const handleReasonSelect = (reason) => {
        setSelections({ reason, subOption: '', eventType: '', fmbOption: '', description: '', date: '' });
        goToStep(STEP_SUB_OPTION);
    };

    const handleSubOptionSelect = (option) => {
        setSelections(prev => ({ ...prev, subOption: option, eventType: '', fmbOption: '' }));
        if (selections.reason === 'Family Function') {
            goToStep(STEP_EVENT_TYPE);
        } else if (selections.reason === '12 Umoor' && option === 'FMB') {
            goToStep(STEP_FMB);
        } else {
            goToStep(STEP_DESCRIPTION);
        }
    };

    const handleEventTypeSelect = (option) => {
        setSelections(prev => ({ ...prev, eventType: option }));
        goToStep(STEP_DESCRIPTION);
    };

    const handleFmbOptionSelect = (option) => {
        setSelections(prev => ({ ...prev, fmbOption: option }));
        goToStep(STEP_DESCRIPTION);
    };

    const leafReason = selections.fmbOption || selections.eventType || selections.subOption || selections.reason;

    const showLaagat =
        selections.reason === 'Life Event' ||
        (selections.reason === 'Family Function' && selections.subOption === 'Markaz');

    const handleGenerate = () => {
        setTimeout(() => navigate('/'), 500);
    };

    const getSubOptionQuestion = () => {
        if (selections.reason === 'Family Function') return 'Event Venue';
        if (selections.reason === 'Travel') return 'Travel Destination';
        if (selections.reason === '12 Umoor') return 'Choose Umoor';
        return 'Select an option';
    };

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="letterHeader">
                    <h1>Jamaat Clearance Letter</h1>
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
                            {selections.reason === 'Family Function' && (
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

                            {!dataReady ? (
                                <button className="letterGenerateBtn" disabled>Loading...</button>
                            ) : (
                                <PDFDownloadLink
                                    document={
                                        <LetterPdfDocument
                                            hofIts={hofIts}
                                            hofName={hofName}
                                            reason={leafReason}
                                            description={selections.description}
                                            date={selections.date || null}
                                            showLaagat={showLaagat}
                                            clearStatus={clearStatus}
                                            openBalances={openBalances}
                                        />
                                    }
                                    fileName={`Clearance-${hofIts || 'draft'}.pdf`}
                                    className="letterGenerateBtn"
                                    onClick={handleGenerate}
                                >
                                    {({ loading }) => loading ? 'Preparing...' : 'Generate Letter'}
                                </PDFDownloadLink>
                            )}

                            <button className="letterBackBtn" onClick={goBack}>Back</button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
