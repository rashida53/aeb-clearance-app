import React, { useState } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_ALL_ACTIVE_USERS, GET_TAKHMEEN, GET_COMMITMENT_FOR_USER, GET_FMB_PLEDGE } from './gql/queries';
import { UPSERT_TAKHMEEN, UPSERT_COMMITMENT_FOR_USER } from './gql/mutations';
import formBg from '../../assets/takhmeen-form.png';

const CURRENT_YEAR = '1448-49';
const LAST_YEAR = '1447-48';

const formatCurrency = (amount) =>
    amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) : '';

// FMB pledge display: no pledge → PENDING; otherwise the amount, appending
// (PENDING) when the pledge itself is still pending.
const formatFmb = (amount, status) => {
    if (amount == null) return 'PENDING';
    const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    return status === 'PENDING' ? `${amt} (PENDING)` : amt;
};

export default function Takhmeen() {
    const { data: usersData } = useQuery(GET_ALL_ACTIVE_USERS);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [zakaat, setZakaat] = useState('');
    const [khumus, setKhumus] = useState('');
    const [silat, setSilat] = useState('');
    const [nafs, setNafs] = useState('');
    const [najwa, setNajwa] = useState('');
    const [nm, setNm] = useState('');
    const [kaffarat, setKaffarat] = useState('');
    const [minnat, setMinnat] = useState('');
    // Editable lumpsum total — mutually exclusive with the itemized amounts above.
    const [lumpTotal, setLumpTotal] = useState('');
    // Wajebaat declarations: ha = adaa in Hazrat Aaliyah, na = no niyyat (with reason).
    const [ha, setHa] = useState(false);
    const [na, setNa] = useState(false);
    const [reason, setReason] = useState('');

    const itemsA = [zakaat, khumus, silat, nafs, najwa, nm, kaffarat, minnat];
    const itemsSumA = itemsA.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    const anyItemA = itemsA.some((v) => v !== '');
    // If any item is entered, the total is the locked sum; otherwise it's the lumpsum.
    const totalA = anyItemA ? itemsSumA : (parseFloat(lumpTotal) || 0);

    const [r1c2, setR1c2] = useState('');
    const [r2c2, setR2c2] = useState('');
    const [r3c2, setR3c2] = useState('');
    const [r4c2, setR4c2] = useState('');
    const [r5c2, setR5c2] = useState('');

    const sfRates = [14, 14, 7, 7, 14];
    const r1p = sfRates[0] * (parseFloat(r1c2) || 0);
    const r2p = sfRates[1] * (parseFloat(r2c2) || 0);
    const r3p = sfRates[2] * (parseFloat(r3c2) || 0);
    const r4p = sfRates[3] * (parseFloat(r4c2) || 0);
    const r5p = sfRates[4] * (parseFloat(r5c2) || 0);
    const totalB = r1p + r2p + r3p + r4p + r5p;

    const [savedTotalA, setSavedTotalA] = useState(null);
    const [savedTotalB, setSavedTotalB] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Austin Khidmats (commitment) amounts — editable, resaved only if changed.
    const [kr, setKr] = useState('');
    const [ut, setUt] = useState('');
    const [initialKr, setInitialKr] = useState('');
    const [initialUt, setInitialUt] = useState('');
    const [fmb, setFmb] = useState(null);

    const [getLastYear, { data: lastYearData, loading: lastYearLoading }] = useLazyQuery(GET_TAKHMEEN, {
        fetchPolicy: 'network-only',
    });
    const [getCurrentYear] = useLazyQuery(GET_TAKHMEEN, {
        fetchPolicy: 'network-only',
        onCompleted: (data) => {
            const tk = data?.getTakhmeen;
            if (tk) {
                setSavedTotalA(tk.wajebaat);
                setSavedTotalB(tk.sf);
                // Only the total is stored, so seed it as the lumpsum value.
                setLumpTotal(tk.wajebaat != null ? String(tk.wajebaat) : '');
                setHa(!!tk.ha);
                setNa(!!tk.na);
                setReason(tk.reason || '');
            }
        },
    });
    const [getCommitment] = useLazyQuery(GET_COMMITMENT_FOR_USER, {
        fetchPolicy: 'network-only',
        onCompleted: (data) => {
            const c = data?.getCommitmentForUser;
            const krVal = c?.kr != null ? String(c.kr) : '';
            const utVal = c?.ut != null ? String(c.ut) : '';
            setKr(krVal);
            setUt(utVal);
            setInitialKr(krVal);
            setInitialUt(utVal);
        },
    });
    const [getFmb] = useLazyQuery(GET_FMB_PLEDGE, {
        fetchPolicy: 'network-only',
        onCompleted: (data) => setFmb(data?.getFmbPledge || null),
    });
    const [upsertTakhmeen] = useMutation(UPSERT_TAKHMEEN);
    const [upsertCommitment] = useMutation(UPSERT_COMMITMENT_FOR_USER);

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
        setSilat('');
        setNafs('');
        setNajwa('');
        setNm('');
        setKaffarat('');
        setMinnat('');
        setLumpTotal('');
        setHa(false);
        setNa(false);
        setReason('');
        setR1c2('');
        setR2c2('');
        setR3c2('');
        setR4c2('');
        setR5c2('');
        setSavedTotalA(null);
        setSavedTotalB(null);
        setKr('');
        setUt('');
        setInitialKr('');
        setInitialUt('');
        setFmb(null);
        setSaved(false);
        setError('');
        getLastYear({ variables: { userId: user._id, year: LAST_YEAR } });
        getCurrentYear({ variables: { userId: user._id, year: CURRENT_YEAR } });
        getCommitment({ variables: { userId: user._id, year: CURRENT_YEAR } });
        getFmb({ variables: { userId: user._id, year: CURRENT_YEAR } });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            // Match the on-screen display exactly (only positive totals count),
            // so we never persist a value the UI isn't showing. No Niyyat forces 0.
            const finalA = na ? 0 : (totalA > 0 ? totalA : (savedTotalA != null ? savedTotalA : null));
            const finalB = totalB > 0 ? totalB : (savedTotalB != null ? savedTotalB : null);
            const promises = [
                upsertTakhmeen({
                    variables: {
                        userId: selectedUser._id,
                        year: CURRENT_YEAR,
                        wajebaat: finalA,
                        sf: finalB,
                        ha,
                        na,
                        reason: na ? (reason || null) : null,
                    },
                }),
            ];
            // Only resave commitments if the KR/UT amounts were edited here.
            if (kr !== initialKr || ut !== initialUt) {
                promises.push(upsertCommitment({
                    variables: {
                        userId: selectedUser._id,
                        year: CURRENT_YEAR,
                        kr: kr !== '' ? parseFloat(kr) : null,
                        ut: ut !== '' ? parseFloat(ut) : null,
                    },
                }));
            }
            await Promise.all(promises);
            setSavedTotalA(finalA);
            setSavedTotalB(finalB);
            setInitialKr(kr);
            setInitialUt(ut);
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
                                min="0"
                                value={zakaat}
                                onChange={(e) => setZakaat(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputKhums"
                                type="number"
                                min="0"
                                value={khumus}
                                onChange={(e) => setKhumus(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputSilat"
                                type="number"
                                min="0"
                                value={silat}
                                onChange={(e) => setSilat(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputNafs"
                                type="number"
                                min="0"
                                value={nafs}
                                onChange={(e) => setNafs(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputNajwa"
                                type="number"
                                min="0"
                                value={najwa}
                                onChange={(e) => setNajwa(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputNazr"
                                type="number"
                                min="0"
                                value={nm}
                                onChange={(e) => setNm(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputKaffarat"
                                type="number"
                                min="0"
                                value={kaffarat}
                                onChange={(e) => setKaffarat(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputMinnat"
                                type="number"
                                min="0"
                                value={minnat}
                                onChange={(e) => setMinnat(e.target.value)}
                                disabled={lumpTotal !== '' || na}
                                placeholder="0"
                            />
                            <input
                                className="tkOverlayInput tkInputTotal"
                                type="number"
                                min="0"
                                value={na ? '0' : (anyItemA ? String(itemsSumA) : lumpTotal)}
                                onChange={(e) => setLumpTotal(e.target.value)}
                                disabled={anyItemA || na}
                                placeholder="0"
                            />

                            {[
                                [sfRates[0], r1c2, setR1c2, r1p, 'sf1'],
                                [sfRates[1], r2c2, setR2c2, r2p, 'sf2'],
                                [sfRates[2], r3c2, setR3c2, r3p, 'sf3'],
                                [sfRates[3], r4c2, setR4c2, r4p, 'sf4'],
                                [sfRates[4], r5c2, setR5c2, r5p, 'sf5'],
                            ].map(([rate, count, setCount, product, key]) => (
                                <React.Fragment key={key}>
                                    <div className={`tkOverlayTotal tkSfRate tkSf${key}Rate`}>
                                        {rate}
                                    </div>
                                    <input
                                        className={`tkOverlayInput tkSfCount tkSf${key}Count`}
                                        type="number"
                                        min="0"
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
                                {totalB > 0 ? formatCurrency(totalB) : savedTotalB != null ? formatCurrency(savedTotalB) : ''}
                            </div>

                            <div className="tkWajebaatDeclarations">
                                <label className={`tkCheckOption ${na ? 'disabled' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={ha}
                                        disabled={na}
                                        onChange={(e) => setHa(e.target.checked)}
                                    />
                                    <span>Adaa in Hazrat Aaliyah</span>
                                </label>
                                <label className={`tkCheckOption ${ha ? 'disabled' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={na}
                                        disabled={ha}
                                        onChange={(e) => setNa(e.target.checked)}
                                    />
                                    <span>No Niyyat</span>
                                </label>
                                {na && (
                                    <div className="tkReasonRow">
                                        <label className="tkReasonLabel">Reason:</label>
                                        <input
                                            className="tkReasonInput"
                                            type="text"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="Enter reason"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="ciSection tkKhidmatSection">
                            <h3 className="ciSectionTitle">Austin Khidmat</h3>
                            <div className="ciInlineRow">
                                <label className="ciInlineLabel">Khidmat Ramadaniyah</label>
                                <input
                                    className="ciInlineInput"
                                    type="number"
                                    placeholder="Amount"
                                    value={kr}
                                    onChange={(e) => setKr(e.target.value)}
                                />
                            </div>
                            <div className="ciInlineRow">
                                <label className="ciInlineLabel">Umoor Taalimiyah</label>
                                <input
                                    className="ciInlineInput"
                                    type="number"
                                    placeholder="Amount"
                                    value={ut}
                                    onChange={(e) => setUt(e.target.value)}
                                />
                            </div>
                            <div className="ciInlineRow">
                                <label className="ciInlineLabel">Faiz ul Mawaid il Burhaniyah</label>
                                <span className="ciInlineValue">{formatFmb(fmb?.amount, fmb?.status)}</span>
                            </div>
                        </div>

                        <div className="tkSaveRow">
                            <button className="wjBtnPrimary" onClick={handleSave} disabled={saving || (!totalA && !totalB && savedTotalA == null && savedTotalB == null && kr === initialKr && ut === initialUt && !ha && !na)}>
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
