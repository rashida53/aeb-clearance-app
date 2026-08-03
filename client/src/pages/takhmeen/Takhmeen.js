import React, { useState } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ALL_ACTIVE_USERS, GET_TAKHMEEN } from './gql/queries';
import { UPSERT_TAKHMEEN } from './gql/mutations';
import formBg from '../../assets/takhmeen-form.png';

const LAST_YEAR = '1447-48';

const formatCurrency = (amount) =>
    amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) : '';

export default function Takhmeen() {
    const { data: usersData } = useQuery(GET_ALL_ACTIVE_USERS);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [zakaat, setZakaat] = useState('');
    const [khumus, setKhumus] = useState('');
    const [nm, setNm] = useState('');

    const totalA = (parseFloat(zakaat) || 0) + (parseFloat(khumus) || 0) + (parseFloat(nm) || 0);

    const [r1c1, setR1c1] = useState('');
    const [r1c2, setR1c2] = useState('');
    const [r2c1, setR2c1] = useState('');
    const [r2c2, setR2c2] = useState('');
    const [r3c1, setR3c1] = useState('');
    const [r3c2, setR3c2] = useState('');
    const [r4c1, setR4c1] = useState('');
    const [r4c2, setR4c2] = useState('');
    const [r5c1, setR5c1] = useState('');
    const [r5c2, setR5c2] = useState('');

    const r1p = (parseFloat(r1c1) || 0) * (parseFloat(r1c2) || 0);
    const r2p = (parseFloat(r2c1) || 0) * (parseFloat(r2c2) || 0);
    const r3p = (parseFloat(r3c1) || 0) * (parseFloat(r3c2) || 0);
    const r4p = (parseFloat(r4c1) || 0) * (parseFloat(r4c2) || 0);
    const r5p = (parseFloat(r5c1) || 0) * (parseFloat(r5c2) || 0);
    const totalB = r1p + r2p + r3p + r4p + r5p;

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const [getLastYear, { data: lastYearData, loading: lastYearLoading }] = useLazyQuery(GET_TAKHMEEN, {
        fetchPolicy: 'network-only',
    });
    const [upsertTakhmeen] = useMutation(UPSERT_TAKHMEEN);

    const allUsers = usersData?.getAllActiveUsers || [];
    const filtered = searchTerm.length >= 2
        ? allUsers.filter((u) =>
            u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10)
        : [];

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSearchTerm('');
        setZakaat('');
        setKhumus('');
        setNm('');
        setR1c1(''); setR1c2('');
        setR2c1(''); setR2c2('');
        setR3c1(''); setR3c2('');
        setR4c1(''); setR4c2('');
        setR5c1(''); setR5c2('');
        setSaved(false);
        setError('');
        getLastYear({ variables: { userId: user._id, year: LAST_YEAR } });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            await upsertTakhmeen({
                variables: {
                    userId: selectedUser._id,
                    year: '1448-49',
                    wajebaat: totalA || null,
                    sf: totalB || null,
                },
            });
            setSaved(true);
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    const lastYear = lastYearData?.getTakhmeen;

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="tkHeader">
                    <h1>Takhmeen</h1>
                </div>

                <div className="ciSearch">
                    <input
                        className="ciSearchInput"
                        type="text"
                        placeholder="HOF Name"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {filtered.length > 0 && (
                        <div className="ciSearchResults">
                            {filtered.map((u) => (
                                <div key={u._id} className="ciSearchItem" onClick={() => handleSelectUser(u)}>
                                    <span className="ciSearchName">{u.fullName}</span>
                                    <span className="ciSearchIts">{u.hofIts}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedUser && (
                    <div className="tkFormWrapper">
                        <div className="ciUserBar">
                            <h3 className="ciUserName">{selectedUser.fullName}</h3>
                            <p className="ciUserDetail">ITS: {selectedUser.hofIts}</p>
                            <p className="ciUserDetail">Mohalla: {selectedUser.zone}</p>
                        </div>

                        <div className="tkFormContainer">
                            <img src={formBg} alt="Takhmeen Form" className="tkFormImage" />

                            <div className="tkLastYearValue">
                                {lastYearLoading
                                    ? '...'
                                    : lastYear?.wajebaat
                                        ? formatCurrency(lastYear.wajebaat)
                                        : '—'}
                            </div>

                            <div className="tkMawdiValue">Austin TX</div>

                            <input
                                className="tkOverlayInput tkInputZakaat"
                                type="number"
                                value={zakaat}
                                onChange={(e) => setZakaat(e.target.value)}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputKhums"
                                type="number"
                                value={khumus}
                                onChange={(e) => setKhumus(e.target.value)}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputNazr"
                                type="number"
                                value={nm}
                                onChange={(e) => setNm(e.target.value)}
                                placeholder="0"
                            />
                            <div className="tkOverlayTotal tkInputTotal">
                                {totalA > 0 ? formatCurrency(totalA) : ''}
                            </div>

                            {/* SF table: c1=rate (هر ایک), c2=count (تعداد), product (Dollars) */}
                            {[
                                [r1c1, setR1c1, r1c2, setR1c2, r1p, 'sf1'],
                                [r2c1, setR2c1, r2c2, setR2c2, r2p, 'sf2'],
                                [r3c1, setR3c1, r3c2, setR3c2, r3p, 'sf3'],
                                [r4c1, setR4c1, r4c2, setR4c2, r4p, 'sf4'],
                                [r5c1, setR5c1, r5c2, setR5c2, r5p, 'sf5'],
                            ].map(([rate, setRate, count, setCount, product, key]) => (
                                <React.Fragment key={key}>
                                    <input
                                        className={`tkOverlayInput tkSfRate tkSf${key}Rate`}
                                        type="number"
                                        value={rate}
                                        onChange={(e) => setRate(e.target.value)}
                                        placeholder="0"
                                    />
                                    <input
                                        className={`tkOverlayInput tkSfCount tkSf${key}Count`}
                                        type="number"
                                        value={count}
                                        onChange={(e) => setCount(e.target.value)}
                                        placeholder="0"
                                    />
                                    <div className={`tkOverlayTotal tkSfProduct tkSf${key}Product`}>
                                        {product > 0 ? product : ''}
                                    </div>
                                </React.Fragment>
                            ))}
                            <div className="tkOverlayTotal tkSfTotalB">
                                {totalB > 0 ? formatCurrency(totalB) : ''}
                            </div>
                        </div>

                        <div className="tkSaveRow">
                            <button className="wjBtnPrimary" onClick={handleSave} disabled={saving || (!totalA && !totalB)}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            {saved && <span className="tkSaved">Takhmeen Complete.</span>}
                            {error && <span className="tkError">{error}</span>}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
