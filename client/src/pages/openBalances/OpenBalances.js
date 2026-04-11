import React from 'react';
import { useQuery } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ME } from '../user/gql/queries';
import { GET_MY_OPEN_BALANCES } from './gql/queries';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const formatDueDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const BalanceCard = ({ balance }) => (
    <div className="balanceCard">
        <div className="customer">{balance.customer || 'Unknown'}</div>
        <div className="balanceMeta">
            <div className="metaRow">
                <span className="metaLabel">Invoice ID</span>
                <span className="metaValue">{balance.qb_id}</span>
            </div>
            <div className="metaRow">
                <span className="metaLabel">Due Date</span>
                <span className="metaValue">{formatDueDate(balance.due)}</span>
            </div>
        </div>
        <div className="balanceAmount">{formatCurrency(balance.balance)}</div>
    </div>
);

const OpenBalances = () => {
    const { data: meData, loading: meLoading } = useQuery(GET_ME);
    const hofIts = meData?.me?.memberHof;

    const { data, loading, error } = useQuery(GET_MY_OPEN_BALANCES, {
        variables: { hofIts: hofIts || '' },
        skip: !hofIts,
    });

    const balances = data?.getMyOpenBalances || [];
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
                    <h1>Open Balances</h1>
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
            </div>
        </>
    );
};

export default OpenBalances;
