import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { schedules as schedApi, nurses as nursesApi } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

const SHIFT_TYPES = ['D', 'E', 'N', 'M', 'O', 'Y', 'X'];
const SHIFT_LABELS: Record<string, string> = { D: '데이', E: '이브닝', N: '나이트', M: '미드', O: '오프', Y: '연차', X: '기타' };
const SHIFT_COLORS: Record<string, string> = { D: '#EBF5FB', E: '#EAFAF1', N: '#F4ECF7', M: '#EAF2F8', O: '#F2F3F4', Y: '#FEF9E7', X: '#FDFEFE' };
const SHIFT_TEXT_COLORS: Record<string, string> = { D: '#1A5276', E: '#1E8449', N: '#6C3483', M: '#154360', O: '#566573', Y: '#7D6608', X: '#717D7E' };

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

export default function ScheduleViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [schedule, setSchedule] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editCell, setEditCell] = useState<{ nurseId: number; date: string; entryId: number; current: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    try {
      const data = await schedApi.get(Number(id));
      setSchedule(data.schedule);
      setEntries(data.entries);
      // 간호사 목록: ward_id로 조회하여 이름 포함
      const wardId = data.schedule?.ward_id;
      if (wardId) {
        const nurseList = await nursesApi.list(wardId);
        setNurses(nurseList);
      } else {
        const nurseIds = [...new Set<number>(data.entries.map((e: any) => e.nurse_id as number))];
        setNurses(nurseIds.map((nid) => ({ id: nid, name: `#${nid}` })));
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadValidation = async () => {
    try {
      const v = await schedApi.validate(Number(id));
      setViolations(v.violations || []);
    } catch {}
  };

  useEffect(() => { loadData(); loadValidation(); }, [id]);

  // 날짜 목록 생성
  const getDates = () => {
    if (!schedule) return [];
    const [year, month] = schedule.year_month.split('-').map(Number);
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = `${schedule.year_month}-${String(i + 1).padStart(2, '0')}`;
      return d;
    });
  };

  // nurse_id 목록
  const getNurseIds = () => {
    const seen = new Set<number>();
    const ids: number[] = [];
    entries.forEach((e) => { if (!seen.has(e.nurse_id)) { seen.add(e.nurse_id); ids.push(e.nurse_id); } });
    return ids;
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
      await loadValidation();
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

  if (loading) return <div className="page"><p>로딩 중...</p></div>;
  if (!schedule) return <div className="page"><p>근무표를 찾을 수 없습니다.</p></div>;

  const allDates = getDates();
  const nurseIds = getNurseIds();
  const hardViolations = violations.filter((v) => v.type === 'HARD');
  const violatedCells = new Set(violations.map((v) => `${v.nurse_id}-${v.date}`));

  // 통계 계산
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
      <div className="page-header">
        <div>
          <button className="btn btn-secondary" onClick={() => navigate('/schedules')} style={{ marginRight: 8 }}>← 목록</button>
          <h2 style={{ display: 'inline' }}>{schedule.year_month} 근무표</h2>
          <span className={`badge ms-2 ${schedule.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-draft'}`} style={{ marginLeft: 8 }}>
            {schedule.status === 'CONFIRMED' ? '확정' : '작성중'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && schedule.status !== 'CONFIRMED' && (
            <button className="btn btn-success" onClick={handleConfirm} disabled={confirming}>
              {confirming ? '확정 중...' : '근무표 확정'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? '내보내는 중...' : 'Excel 내보내기'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* 위반 요약 */}
      {hardViolations.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          ⚠ 하드 제약 위반 {hardViolations.length}건 — {hardViolations.slice(0, 3).map((v) => v.message).join(' / ')}
          {hardViolations.length > 3 && ` 외 ${hardViolations.length - 3}건`}
        </div>
      )}

      {/* 근무표 테이블 */}
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
                    <div>{d.getDate()}</div>
                    <div style={{ fontSize: 10 }}>{DAYS_KR[day]}</div>
                  </th>
                );
              })}
              <th>D</th><th>E</th><th>N</th><th>M</th><th>O</th><th>Y</th>
            </tr>
          </thead>
          <tbody>
            {nurseIds.map((nid) => (
              <tr key={nid}>
                <td className="nurse-col">{nurses.find((n) => n.id === nid)?.name || `#${nid}`}</td>
                {allDates.map((date) => {
                  const entry = entryMap[nid]?.[date];
                  const st = entry?.shift_type || '?';
                  const hasViolation = violatedCells.has(`${nid}-${date}`);
                  const isEditing = editCell?.nurseId === nid && editCell?.date === date;
                  return (
                    <td key={date}
                      onClick={() => handleCellClick(nid, date)}
                      style={{
                        background: SHIFT_COLORS[st] || '#fff',
                        color: SHIFT_TEXT_COLORS[st] || '#333',
                        cursor: isAdmin && schedule.status !== 'CONFIRMED' ? 'pointer' : 'default',
                        border: hasViolation ? '2px solid #E74C3C' : undefined,
                        fontWeight: entry?.is_manually_edited ? 700 : 400,
                        textAlign: 'center',
                        minWidth: 32,
                        position: 'relative',
                      }}>
                      {isEditing ? (
                        <select autoFocus style={{ width: '100%', fontSize: 12, border: 'none', background: 'transparent' }}
                          value={st} onChange={(e) => handleCellSave(e.target.value)}
                          onBlur={() => setEditCell(null)}>
                          {SHIFT_TYPES.map((s) => <option key={s} value={s}>{s} ({SHIFT_LABELS[s]})</option>)}
                        </select>
                      ) : st}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center' }}>{stats[nid]?.D}</td>
                <td style={{ textAlign: 'center' }}>{stats[nid]?.E}</td>
                <td style={{ textAlign: 'center' }}>{stats[nid]?.N}</td>
                <td style={{ textAlign: 'center' }}>{stats[nid]?.M}</td>
                <td style={{ textAlign: 'center' }}>{stats[nid]?.O}</td>
                <td style={{ textAlign: 'center' }}>{stats[nid]?.Y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 위반 목록 상세 */}
      {violations.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="card-title">제약 위반 상세 ({violations.length}건)</h3>
          <table className="table table-compact">
            <thead><tr><th>유형</th><th>규칙</th><th>내용</th><th>날짜</th></tr></thead>
            <tbody>
              {violations.slice(0, 20).map((v, i) => (
                <tr key={i} style={{ color: v.type === 'HARD' ? '#E74C3C' : '#E67E22' }}>
                  <td>{v.type}</td><td>{v.rule}</td><td>{v.message}</td><td>{v.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && schedule.status !== 'CONFIRMED' && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          셀을 클릭하여 근무를 수정할 수 있습니다. 굵게 표시된 셀은 수동 수정된 항목입니다.
        </p>
      )}
    </div>
  );
}
