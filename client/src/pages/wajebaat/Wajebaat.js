import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ME } from '../user/gql/queries';
import { GET_MY_OPEN_BALANCES } from '../openBalances/gql/queries';

const TOTAL_STEPS = 4;
const BILLPAY_URL = 'https://www.billandpay.com/web/login.php?m=17357';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const StepHeader = ({ step, total, title, explanation }) => (
    <div className="wajebaatStepHeader">
        <div className="letterStepIndicator">Step {step} of {total}</div>
        <h3 className="wajebaatStepTitle">{title}</h3>
        {explanation && <p className="wajebaatStepExplanation">{explanation}</p>}
    </div>
);

export default function Wajebaat() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ accountNumber: '', routingNumber: '' });
    const [errors, setErrors] = useState({});

    const { data: meData, loading: meLoading } = useQuery(GET_ME);
    const hofIts = meData?.me?.memberHof;

    const { data: balancesData, loading: balancesLoading } = useQuery(GET_MY_OPEN_BALANCES, {
        variables: { hofIts: hofIts || '' },
        skip: !hofIts,
    });

    const openBalances = balancesData?.getMyOpenBalances || [];
    const sabelPledges = openBalances.filter(b => /sabeel/i.test(b.qb_id));
    const sabelClear = sabelPledges.length === 0;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateStep1 = () => {
        const newErrors = {};
        if (!form.accountNumber.trim()) newErrors.accountNumber = 'Account number is required';
        if (!form.routingNumber.trim()) newErrors.routingNumber = 'Routing number is required';
        else if (!/^\d{9}$/.test(form.routingNumber.trim())) newErrors.routingNumber = 'Routing number must be 9 digits';
        return newErrors;
    };

    const handleNext = () => {
        if (step === 1) {
            const newErrors = validateStep1();
            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => setStep(prev => prev - 1);

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="letterHeader">
                    <h1>Wajebaat</h1>
                </div>

                <div className="letterForm">

                    {step === 1 && (
                        <div className="letterStep">
                            <StepHeader
                                step={1}
                                total={TOTAL_STEPS}
                                title="ACH Bank Authorization"
                                explanation="To fulfill your Wajebaat, an ACH withdrawal will be initiated from your bank account. Please provide your bank account and routing numbers below."
                            />
                            <div className="formGroup">
                                <label htmlFor="accountNumber">Bank Account Number</label>
                                <input
                                    id="accountNumber"
                                    name="accountNumber"
                                    type="text"
                                    inputMode="numeric"
                                    value={form.accountNumber}
                                    onChange={handleChange}
                                    placeholder="Enter your account number"
                                />
                                {errors.accountNumber && (
                                    <span className="formError">{errors.accountNumber}</span>
                                )}
                            </div>
                            <div className="formGroup">
                                <label htmlFor="routingNumber">Bank Routing Number</label>
                                <input
                                    id="routingNumber"
                                    name="routingNumber"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={9}
                                    value={form.routingNumber}
                                    onChange={handleChange}
                                    placeholder="9-digit routing number"
                                />
                                {errors.routingNumber && (
                                    <span className="formError">{errors.routingNumber}</span>
                                )}
                            </div>
                            <button className="btnPrimary" onClick={handleNext}>
                                Next
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="letterStep">
                            <StepHeader
                                step={3}
                                total={TOTAL_STEPS}
                                title="Khidmat Ramadaniyah"
                                explanation="Local contributions, some mandatory and some optional."
                            />
                            <button className="btnPrimary" onClick={handleNext}>Next</button>
                            <button className="letterBackBtn" onClick={handleBack}>Back</button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="letterStep">
                            <StepHeader
                                step={4}
                                total={TOTAL_STEPS}
                                title="Pick a Slot"
                                explanation={null}
                            />
                            <button className="letterBackBtn" onClick={handleBack}>Back</button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="letterStep">
                            <StepHeader
                                step={2}
                                total={TOTAL_STEPS}
                                title="Sabeel"
                                explanation={sabelClear ? null : 'Sabeel must be clear to select a Wajebaat Bethak.'}
                            />

                            {meLoading || balancesLoading ? (
                                <div className="loadingState">Loading…</div>
                            ) : sabelClear ? (
                                <>
                                    <div className="letterSuccessMsg" style={{ marginBottom: 20 }}>
                                        Sabeel is Clear. Shurkan for your support.
                                    </div>
                                    <button className="btnPrimary" onClick={handleNext}>
                                        Next
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="wajebaatSabelPledges">
                                        {sabelPledges.map(pledge => (
                                            <div key={pledge._id} className="wajebaatPledgeRow">
                                                <div className="wajebaatPledgeId">{pledge.qb_id}</div>
                                                <div className="wajebaatPledgeAmount">{formatCurrency(pledge.balance)}</div>
                                                <a
                                                    href={BILLPAY_URL}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btnAdaa wajebaatAdaaBtn"
                                                >
                                                    Adaa
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <button className="letterBackBtn" onClick={handleBack}>Back</button>
                        </div>
                    )}

                </div>
            </div>
        </>
    );
}
