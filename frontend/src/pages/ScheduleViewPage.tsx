import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { schedules as schedApi, nurses as nursesApi, shiftRequests as reqApi } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

const SHIFT_TYPES = ['D', 'E', 'N', 'M', 'O', 'Y', 'X'];
const SHIFT_LABELS: Record<string, string> = { D: '데이', E: '이브닝', N: '나이트', M: '미드', O: '오프', Y: '연차', X: '기타' };
const SHIFT_COLORS: Record<string, string> = {
  D: 'var(--shift-d-bg)', E: 'var(--shift-e-bg)', N: 'var(--shift-n-bg)',
  M: 'var(--shift-m-bg)', O: 'var(--shift-o-bg)', Y: 'var(--shift-y-bg)', X: 'var(--shift-x-bg)',
};
const SHIFT_TEXT_COLORS: Record<string, string> = {
  D: 'var(--shift-d-text)', E: 'var(--shift-e-text)', N: 'var(--shift-n-text)',
  M: 'var(--shift-m-text)', O: 'var(--shift-o-text)', Y: 'var(--shift-y-text)', X: 'var(--shift-x-text)',
};

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
const GRADE_ORDER: Record<string, number> = { HN: 0, CN: 1, RN: 2, AN: 3, PN: 4 };

export default function ScheduleViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [schedule, setSchedule] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [approvedOffDates, setApprovedOffDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editCell, setEditCell] = useState<{ nurseId: number; date: string; entryId: number; current: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [validating, setValidating] = useState(false);

  const loadData = async () => {
    try {
      const data = await schedApi.get(Number(id));
      setSchedule(data.schedule);
      setEntries(data.entries);
      const wardId = data.schedule?.ward_id;
      if (wardId) {
        const nurseList = await nursesApi.list(wardId);
        setNurses(nurseList);
      }
      if (data.schedule?.year_month) {
        try {
          const reqs = await reqApi.list(data.schedule.year_month);
          const offDates = new Set<string>();
          reqs.filter((r: any) => r.status === 'APPROVED' && r.requested_shift_type === 'O')
            .forEach((r: any) => offDates.add(`${r.nurse_id}-${r.date}`));
          setApprovedOffDates(offDates);
        } catch { }
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadValidation = async () => {
    setValidating(true);
    try {
      const v = await schedApi.validate(Number(id));
      setViolations(v.violations || []);
    } catch { }
    finally { setValidating(false); }
  };

  useEffect(() => { loadData(); loadValidation(); }, [id]);

  const getDates = () => {
    if (!schedule) return [];
    const [year, month] = schedule.year_month.split('-').map(Number);
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, i) =>
      `${schedule.year_month}-${String(i + 1).padStart(2, '0')}`
    );
  };

  const getSortedNurseIds = () => {
    const nurseIdSet = new Set<number>();
    entries.forEach((e) => nurseIdSet.add(e.nurse_id));
    const nurseMap = new Map(nurses.map((n) => [n.id, n]));
    const nurseIds = Array.from(nurseIdSet);
    nurseIds.sort((a, b) => {
      const na = nurseMap.get(a);
      const nb = nurseMap.get(b);
      const ga = GRADE_ORDER[na?.grade] ?? 9;
      const gb = GRADE_ORDER[nb?.grade] ?? 9;
      if (ga !== gb) return ga - gb;
      return (na?.sort_order || 99) - (nb?.sort_order || 99);
    });
    return nurseIds;
  };

  const entryMap: Record<number, Record<string, any>> = {};
  entries.forEach((e) => {
    if (!entryMap[e.nurse_id]) entryMap[e.nurse_id] = {};
    entryMap[e.nurse_id][e.date] = e;
  });

  const handleCellClick = (nurseId: number, date: string) => {
    if (!isAdmin || schedule?.status === 'CONFIRMED') return;
    const entry = entryMap[nurseId]?.[date];
    if (!entry) return;
    setEditCell({ nurseId, date, entryId: entry.id, current: entry.shift_type });
  };

  const handleCellSave = async (newShift: string) => {
    if (!editCell) return;
    try {
      await schedApi.updateEntry(Number(id), editCell.entryId, newShift);
      await loadData();
    } catch (e: any) { setError(e.message); }
    setEditCell(null);
  };

  const handleConfirm = async () => {
    if (!confirm('근무표를 확정하시겠습니까? 확정 후에는 수정할 수 없습니다.')) return;
    setConfirming(true);
    try {
      await schedApi.confirm(Number(id));
      await loadData();
    } catch (e: any) { setError(e.message); }
    finally { setConfirming(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await schedApi.export(Number(id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_${schedule?.year_month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e.message); }
    finally { setExporting(false); }
  };

  if (loading) return <div className="page"><div className="loading">로딩 중...</div></div>;
  if (!schedule) return <div className="page"><p>근무표를 찾을 수 없습니다.</p></div>;

  const allDates = getDates();
  const nurseIds = getSortedNurseIds();
  const hardViolations = violations.filter((v) => v.type === 'HARD');
  const violatedCells = new Set(violations.map((v) => `${v.nurse_id}-${v.date}`));
  const nurseMap = new Map(nurses.map((n) => [n.id, n]));

  const separatorIndices: Set<number> = new Set();
  for (let i = 1; i < nurseIds.length; i++) {
    const prevGrade = nurseMap.get(nurseIds[i - 1])?.grade;
    const curGrade = nurseMap.get(nurseIds[i])?.grade;
    if (prevGrade !== curGrade && (curGrade === 'AN' || curGrade === 'PN')) {
      separatorIndices.add(i);
    }
  }

  const stats: Record<number, Record<string, number>> = {};
  nurseIds.forEach((nid) => {
    stats[nid] = { D: 0, E: 0, N: 0, M: 0, O: 0, Y: 0, X: 0 };
    allDates.forEach((date) => {
      const st = entryMap[nid]?.[date]?.shift_type;
      if (st && stats[nid][st] !== undefined) stats[nid][st]++;
    });
  });

  return (
    <div className="page">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline" onClick={() => navigate('/schedules')}
            style={{ padding: '6px 12px' }}>
            ← 목록
          </button>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
            {schedule.year_month} 근무표
          </h2>
          <span className={`badge ${schedule.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-draft'}`}>
            {schedule.status === 'CONFIRMED' ? '✓ 확정' : '● 작성중'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={loadValidation} disabled={validating}>
            {validating ? '검증 중...' : '🔍 검증'}
          </button>
          {isAdmin && schedule.status !== 'CONFIRMED' && (
            <button className="btn btn-success" onClick={handleConfirm} disabled={confirming}>
              {confirming ? '확정 중...' : '✓ 근무표 확정'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? '내보내는 중...' : '📥 Excel'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {hardViolations.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          <div>
            <strong>⚠️ 하드 제약 위반 {hardViolations.length}건</strong>
            <div style={{ marginTop: 4, fontSize: '0.82rem' }}>
              {hardViolations.slice(0, 3).map((v) => v.message).join(' / ')}
              {hardViolations.length > 3 && ` 외 ${hardViolations.length - 3}건`}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="nurse-col">간호사</th>
                {allDates.map((date) => {
                  const d = new Date(date + 'T00:00:00');
                  const day = d.getDay();
                  const isWknd = day === 0 || day === 6;
                  return (
                    <th key={date} className={`date-col${isWknd ? ' weekend' : ''}`}>
                      <div style={{ fontWeight: 700 }}>{d.getDate()}</div>
                      <div style={{ fontSize: '0.65rem', color: isWknd ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                        {DAYS_KR[day]}
                      </div>
                    </th>
                  );
                })}
                <th style={{ background: 'var(--shift-d-bg)', color: 'var(--shift-d-text)' }}>D</th>
                <th style={{ background: 'var(--shift-e-bg)', color: 'var(--shift-e-text)' }}>E</th>
                <th style={{ background: 'var(--shift-n-bg)', color: 'var(--shift-n-text)' }}>N</th>
                <th style={{ background: 'var(--shift-m-bg)', color: 'var(--shift-m-text)' }}>M</th>
                <th style={{ background: 'var(--shift-o-bg)', color: 'var(--shift-o-text)' }}>O</th>
                <th style={{ background: 'var(--shift-y-bg)', color: 'var(--shift-y-text)' }}>Y</th>
              </tr>
            </thead>
            <tbody>
              {nurseIds.map((nid, idx) => {
                const nurse = nurseMap.get(nid);
                const isSeparator = separatorIndices.has(idx);
                return (
                  <tr key={nid} className={isSeparator ? 'grade-separator' : ''}>
                    <td className="nurse-col">
                      <span className={`badge badge-grade-${(nurse?.grade || 'rn').toLowerCase()}`}
                        style={{ marginRight: 6, fontSize: '0.65rem' }}>
                        {nurse?.grade}
                      </span>
                      {nurse?.name || `#${nid}`}
                    </td>
                    {allDates.map((date) => {
                      const entry = entryMap[nid]?.[date];
                      const st = entry?.shift_type || '?';
                      const hasViolation = violatedCells.has(`${nid}-${date}`);
                      const isEditing = editCell?.nurseId === nid && editCell?.date === date;
                      const isApprovedOff = approvedOffDates.has(`${nid}-${date}`);
                      const d = new Date(date + 'T00:00:00');
                      const isWknd = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <td key={date}
                          onClick={() => handleCellClick(nid, date)}
                          className={isWknd ? 'weekend-cell' : ''}
                          style={{
                            background: isApprovedOff ? '#fff7ed' : SHIFT_COLORS[st] || '#fff',
                            color: SHIFT_TEXT_COLORS[st] || 'var(--text)',
                            cursor: isAdmin && schedule.status !== 'CONFIRMED' ? 'pointer' : 'default',
                            border: hasViolation ? '2px solid var(--accent-rose)' : undefined,
                            fontWeight: entry?.is_manually_edited ? 800 : 500,
                            textAlign: 'center',
                            minWidth: 34,
                            position: 'relative',
                            fontSize: '0.78rem',
                            transition: 'all 0.1s ease',
                          }}>
                          {isEditing ? (
                            <select autoFocus style={{ width: '100%', fontSize: '0.72rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                              value={st} onChange={(e) => handleCellSave(e.target.value)}
                              onBlur={() => setEditCell(null)}>
                              {SHIFT_TYPES.map((s) => <option key={s} value={s}>{s} ({SHIFT_LABELS[s]})</option>)}
                            </select>
                          ) : (
                            <>
                              {st}
                              {isApprovedOff && <span style={{ position: 'absolute', top: 0, right: 1, fontSize: '0.5rem', color: 'var(--accent-amber)' }}>★</span>}
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', background: 'var(--shift-d-bg)', fontWeight: 600, fontSize: '0.78rem' }}>{stats[nid]?.D}</td>
                    <td style={{ textAlign: 'center', background: 'var(--shift-e-bg)', fontWeight: 600, fontSize: '0.78rem' }}>{stats[nid]?.E}</td>
                    <td style={{ textAlign: 'center', background: 'var(--shift-n-bg)', fontWeight: 600, fontSize: '0.78rem' }}>{stats[nid]?.N}</td>
                    <td style={{ textAlign: 'center', background: 'var(--shift-m-bg)', fontWeight: 600, fontSize: '0.78rem' }}>{stats[nid]?.M}</td>
                    <td style={{ textAlign: 'center', background: 'var(--shift-o-bg)', fontWeight: 600, fontSize: '0.78rem' }}>{stats[nid]?.O}</td>
                    <td style={{ textAlign: 'center', background: 'var(--shift-y-bg)', fontWeight: 600, fontSize: '0.78rem' }}>{stats[nid]?.Y}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="card-title">⚠️ 제약 위반 상세 ({violations.length}건)</h3>
          <table className="table table-compact">
            <thead><tr><th>유형</th><th>규칙</th><th>내용</th><th>날짜</th></tr></thead>
            <tbody>
              {violations.slice(0, 20).map((v, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge ${v.type === 'HARD' ? 'badge-rejected' : 'badge-pending'}`}>
                      {v.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{v.rule}</td>
                  <td style={{ fontSize: '0.82rem' }}>{v.message}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{v.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && schedule.status !== 'CONFIRMED' && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 12, background: 'var(--bg)', padding: '10px 14px', borderRadius: 8 }}>
          💡 셀을 클릭하여 근무를 수정할 수 있습니다. <strong>굵게</strong> 표시된 셀은 수동 수정된 항목입니다. ★ 표시는 승인된 OFF 요청입니다.
        </p>
      )}
    </div>
  );
}
