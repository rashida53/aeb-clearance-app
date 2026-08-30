import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import Nav from '../../components/Nav';
import { GET_MASJID_DASHBOARD, GET_ALL_ACTIVE_USERS, GET_MASJID_NIYYAT_FOR_USER } from './gql/queries';
import { UPSERT_MASJID_NIYYAT } from './gql/mutations';

const formatWholeCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

// Compact millions form (e.g. $4.69M) — keeps the milestone labels from
// overlapping now that the bar spans the full width of the card.
const formatMillions = (amount) => `$${((amount || 0) / 1e6).toFixed(2)}M`;

const ANIM_DURATION = 2000;

function OverallBar({ t1, t2, adaa }) {
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
        <div className="adminSection" ref={sectionRef}>
            <h2 className="adminSectionTitle">Overall</h2>
            <div className="niyyatBarWrap">
                <div className="niyyatTrack">
                    <div className="niyyatFill" style={{ width: `${animPct}%` }} />
                    <div className="niyyatMilestone" style={{ left: `${t1Pct}%` }}>
                        <div className="niyyatMilestoneLine" />
                        <div className="niyyatMilestoneLabel">
                            <span className="niyyatMilestoneName">Niyyat</span>
                            <span className="niyyatMilestoneAmt">{formatMillions(t1)}</span>
                        </div>
                    </div>
                    <div className="niyyatMilestone" style={{ right: 0 }}>
                        <div className="niyyatMilestoneLine" />
                        <div className="niyyatMilestoneLabel">
                            <span className="niyyatMilestoneName">Future Niyyat</span>
                            <span className="niyyatMilestoneAmt">{formatMillions(t2)}</span>
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
}

function TakhmeenForm({ onSaved }) {
    const { data: usersData } = useQuery(GET_ALL_ACTIVE_USERS);
    const [getNiyyat, { data: niyyatData }] = useLazyQuery(GET_MASJID_NIYYAT_FOR_USER, { fetchPolicy: 'network-only' });
    const [upsertMasjidNiyyat] = useMutation(UPSERT_MASJID_NIYYAT);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [t1, setT1] = useState('');
    const [t2, setT2] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const allUsers = usersData?.getAllActiveUsers || [];
    const filtered = searchTerm.length >= 2
        ? allUsers.filter((u) => u.fullName.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
        : [];

    useEffect(() => {
        const n = niyyatData?.getMasjidNiyyatForUser;
        if (!n) return;
        setT1(n.t1 != null ? String(n.t1) : '');
        setT2(n.t2 != null ? String(n.t2) : '');
    }, [niyyatData]);

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSearchTerm('');
        setT1('');
        setT2('');
        setSuccess('');
        setError('');
        getNiyyat({ variables: { userId: user._id } });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await upsertMasjidNiyyat({
                variables: { userId: selectedUser._id, t1: parseFloat(t1) || 0, t2: parseFloat(t2) || 0 },
            });
            setSuccess('Saved');
            if (onSaved) onSaved();
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    const isValid = selectedUser && t1 && t2;

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">Takhmeen</h2>

            <div className="ciSearch">
                <input
                    className="ciSearchInput"
                    type="text"
                    placeholder="HOF Name"
                    value={selectedUser ? selectedUser.fullName : searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setSelectedUser(null); setT1(''); setT2(''); setSuccess(''); }}
                />
                {filtered.length > 0 && !selectedUser && (
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
                <div className="masjidTakhmeenFields">
                    <div className="masjidTakhmeenUser">
                        <span className="masjidTakhmeenName">{selectedUser.fullName}</span>
                        <span className="masjidTakhmeenIts">ITS: {selectedUser.hofIts}</span>
                    </div>
                    <div className="adminFormGroup">
                        <label>Niyyat</label>
                        <input type="number" value={t1} onChange={(e) => setT1(e.target.value)} min="0" className="masjidTakhmeenInput" />
                    </div>
                    <div className="adminFormGroup">
                        <label>Future Niyyat</label>
                        <input type="number" value={t2} onChange={(e) => setT2(e.target.value)} min="0" className="masjidTakhmeenInput" />
                    </div>
                    {error && <p className="adminError">{error}</p>}
                    {success && <p className="adminSuccess">{success}</p>}
                </div>
            )}
            {selectedUser && (
                <div className="masjidTakhmeenAction">
                    <button className="adminBtn" onClick={handleSave} disabled={!isValid || saving}>
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            )}
        </div>
    );
}

function MasjidTable({ rows }) {
    const [sortBy, setSortBy] = useState('NAME');
    const [progressFilter, setProgressFilter] = useState('ALL');
    const [zoneFilter, setZoneFilter] = useState('ALL');

    const zones = [...new Set(rows.map((r) => r.user.zone).filter(Boolean))].sort();

    const filtered = rows.filter((r) => {
        if (zoneFilter !== 'ALL' && r.user.zone !== zoneFilter) return false;
        if (progressFilter === 'PENDING') return r.pending;
        if (progressFilter === 'BELOW_50') return !r.pending && r.progress < 50;
        if (progressFilter === '50_TO_99') return !r.pending && r.progress >= 50 && r.progress < 100;
        if (progressFilter === 'COMPLETE') return !r.pending && r.progress >= 100;
        return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'NAME') return a.user.fullName.localeCompare(b.user.fullName);
        if (sortBy === 'ZONE') return (a.user.zone || '').localeCompare(b.user.zone || '');
        if (sortBy === 'TAKHMEEN') return (b.t1 || 0) - (a.t1 || 0);
        if (sortBy === 'PROGRESS') {
            if (a.pending && b.pending) return a.user.fullName.localeCompare(b.user.fullName);
            if (a.pending) return 1;
            if (b.pending) return -1;
            return b.progress - a.progress;
        }
        return 0;
    });

    const handleSort = (col) => setSortBy(col);

    return (
        <div className="adminSection">
            <h2 className="adminSectionTitle">HOF Dashboard</h2>

            <div className="adminControls">
                <div className="adminFormGroup">
                    <label>Zone</label>
                    <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
                        <option value="ALL">All</option>
                        {zones.map((z) => (
                            <option key={z} value={z}>{z}</option>
                        ))}
                    </select>
                </div>
                <div className="adminFormGroup">
                    <label>Progress</label>
                    <select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)}>
                        <option value="ALL">All</option>
                        <option value="PENDING">Pending</option>
                        <option value="BELOW_50">Below 50%</option>
                        <option value="50_TO_99">50% – 99%</option>
                        <option value="COMPLETE">100%+</option>
                    </select>
                </div>
            </div>

            <div className="adminTableWrapper">
                <table className="adminTable">
                    <thead>
                        <tr>
                            <th className="masjidSortable" onClick={() => handleSort('NAME')}>
                                Name {sortBy === 'NAME' && '▾'}
                            </th>
                            <th className="masjidSortable" onClick={() => handleSort('ZONE')}>
                                Zone {sortBy === 'ZONE' && '▾'}
                            </th>
                            <th className="masjidSortable" onClick={() => handleSort('TAKHMEEN')}>
                                Takhmeen {sortBy === 'TAKHMEEN' && '▾'}
                            </th>
                            <th>Future Takhmeen</th>
                            <th>Adaa</th>
                            <th className="masjidSortable" onClick={() => handleSort('PROGRESS')}>
                                Progress {sortBy === 'PROGRESS' && '▾'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((r) => (
                            <tr key={r.user._id}>
                                <td>{r.user.fullName}</td>
                                <td>{r.user.zone || '—'}</td>
                                <td>{r.pending ? '—' : formatWholeCurrency(r.t1)}</td>
                                <td>{r.pending ? '—' : formatWholeCurrency(r.t2)}</td>
                                <td>{r.pending ? '—' : formatWholeCurrency(r.adaa)}</td>
                                <td>
                                    {r.pending ? (
                                        <span className="masjidPending">PENDING</span>
                                    ) : (
                                        <div className="masjidProgressCell">
                                            <div className="masjidProgressTrack">
                                                <div
                                                    className="masjidProgressFill"
                                                    style={{ width: `${Math.min(r.progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="masjidProgressPct">{r.progress}%</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function MasjidPage() {
    const { data, loading, refetch } = useQuery(GET_MASJID_DASHBOARD);
    const rows = data?.getMasjidDashboard || [];

    const totalT1 = rows.reduce((s, r) => s + (r.t1 || 0), 0);
    const totalT2 = rows.reduce((s, r) => s + (r.t2 || 0), 0);
    const totalAdaa = rows.reduce((s, r) => s + (r.adaa || 0), 0);

    return (
        <>
            <Nav />
            <div className="pageContainer">
                <div className="adminHeader">
                    <h1>Masjid</h1>
                </div>

                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <>
                        <OverallBar t1={totalT1} t2={totalT2} adaa={totalAdaa} />
                        <TakhmeenForm onSaved={refetch} />
                        <MasjidTable rows={rows} />
                    </>
                )}
            </div>
        </>
    );
}
