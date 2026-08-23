import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ME } from '../user/gql/queries';
import { GET_MY_OPEN_BALANCES, GET_MY_MASJID_NIYYAT } from './gql/queries';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatWholeCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const formatDueDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const BalanceCard = ({ balance }) => (
    <div className="balanceCard">
        <div className="customer">{balance.qb_id}</div>
        <div className="balanceMeta">
            <div className="metaRow">
                <span className="metaLabel">Amount</span>
                <span className="metaValue">{formatCurrency(balance.amount)}</span>
            </div>
            <div className="metaRow">
                <span className="metaLabel">Due</span>
                <span className="metaValue">{formatDueDate(balance.due)}</span>
            </div>
        </div>
        <div className="balanceAmount">{formatCurrency(balance.balance)}</div>
    </div>
);

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
        <div className="niyyatSection" ref={sectionRef}>
            <h1 className="niyyatTitle">Masjid Niyyat</h1>
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
                    <div className="niyyatMilestone" style={{ left: '100%' }}>
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

const OpenBalances = () => {
    const { data: meData, loading: meLoading } = useQuery(GET_ME);
    const hofIts = meData?.me?.memberHof;

    const { data, loading, error } = useQuery(GET_MY_OPEN_BALANCES, {
        variables: { hofIts: hofIts || '' },
        skip: !hofIts,
    });

    const { data: niyyatData, loading: niyyatLoading } = useQuery(GET_MY_MASJID_NIYYAT);

    const balances = data?.getMyOpenBalances || [];
    const customerName = balances[0]?.customer || '';
    const totalBalance = balances.reduce((sum, b) => sum + (b.balance || 0), 0);

    if (meLoading || loading) {
        return (
            <>
                <Nav />
                <div className="pageContainer">
                    <div className="loadingState">Loading your balances…</div>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <Nav />
                <div className="pageContainer">
                    <div className="formSubmitError">
                        Error loading balances. Please refresh and try again.
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="openBalancesHeader">
                    <h1>{customerName || ''}</h1>
                    {balances.length > 0 && (
                        <p style={{ marginTop: '8px', fontWeight: 'bold', color: 'var(--color-navy)', fontSize: '18px' }}>
                            Total due: {formatCurrency(totalBalance)}
                        </p>
                    )}
                </div>

                {balances.length === 0 ? (
                    <div className="noBalances">
                        <h3>All clear!</h3>
                        <p>You have no outstanding balances.</p>
                    </div>
                ) : (
                    <div className="balancesGrid">
                        {balances.map((balance) => (
                            <BalanceCard key={balance._id} balance={balance} />
                        ))}
                    </div>
                )}

                <div style={{ marginTop: '32px', textAlign: 'center' }}>
                    <a
                        href="https://www.billandpay.com/web/login.php?m=17357"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btnAdaa"
                    >
                        Adaa Pledges
                    </a>
                </div>

                {!niyyatLoading && niyyatData?.getMyMasjidNiyyat && (
                    <MasjidNiyyatBar
                        t1={niyyatData.getMyMasjidNiyyat.t1}
                        t2={niyyatData.getMyMasjidNiyyat.t2}
                        adaa={niyyatData.getMyMasjidNiyyat.adaa}
                    />
                )}

                {!niyyatLoading && !niyyatData?.getMyMasjidNiyyat && (
                    <div className="wjStep" style={{ marginTop: '32px' }}>
                        <p style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-navy)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '24px' }}>
                            Please contact a member of the Masjid team to be Shaamil in Austin Masjid Taameer
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
                                <div className="wjContactName">Shk Murtaza bhai Rawat</div>
                                <div className="wjContactDesignation">Secretary</div>
                                <a href="tel:8325268734" className="wjContactPhone">832-526-8734</a>
                            </div>
                            <div className="wjContactCard">
                                <div className="wjContactName">M Murtaza bhai Hirani</div>
                                <div className="wjContactDesignation">Masjid Committee</div>
                                <a href="tel:5124135284" className="wjContactPhone">512-413-5284</a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default OpenBalances;
