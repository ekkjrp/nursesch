import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { schedules as schedulesApi, nurses as nursesApi } from '../api.ts';

// 근무표 테이블 뷰 (designreq.md 9.2 — 핵심 화면)
// 행: 간호사, 열: 날짜, 셀: 근무 유형 + 색상 코딩

const SHIFT_OPTIONS = ['D', 'E', 'N', 'O', 'X'];
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function ScheduleViewPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<any>(null);
  const [nurseList, setNurseList] = useState<any[]>([]);
  const [editCell, setEditCell] = useState<{ nurseId: number; date: string } | null>(null);
  const [violations, setViolations] = useState<any[]>([]);

  const loadSchedule = () => {
    schedulesApi.get(Number(id)).then(data => {
      setSchedule(data);
      // 검증 결과도 로드
      schedulesApi.validate(Number(id)).then(v => setViolations(v.violations || [])).catch(() => {});
    }).catch(() => {});
  };

  useEffect(() => {
    loadSchedule();
    if (user) nursesApi.list(user.wardId).then(setNurseList).catch(() => {});
  }, [id, user]);

  if (!schedule) return <div className="loading">로딩 중...</div>;

  const [year, month] = schedule.yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${schedule.yearMonth}-${String(d).padStart(2, '0')}`);
  }

  // 엔트리 맵: nurseId-date -> shiftType
  const entryMap = new Map<string, string>();
  for (const e of schedule.entries || []) {
    entryMap.set(`${e.nurseId}-${e.date}`, e.shiftType);
  }

  // 위반 맵: nurseId-date -> 위반 여부
  const violationSet = new Set<string>();
  for (const v of violations) {
    if (v.type === 'HARD' && v.nurseId && v.date) {
      violationSet.add(`${v.nurseId}-${v.date}`);
    }
  }

  const handleCellClick = (nurseId: number, date: string) => {
    if (!isAdmin || schedule.status === 'CONFIRMED') return;
    setEditCell({ nurseId, date });
  };

  const handleShiftChange = async (shiftType: string) => {
    if (!editCell) return;
    try {
      await schedulesApi.updateEntry(Number(id), editCell.nurseId, editCell.date, shiftType);
      setEditCell(null);
      loadSchedule();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirm = async () => {
    if (!confirm('근무표를 확정하시겠습니까? 확정 후에는 수정이 제한됩니다.')) return;
    try {
      await schedulesApi.confirm(Number(id));
      loadSchedule();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await schedulesApi.export(Number(id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule_${schedule.yearMonth}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('내보내기 실패');
    }
  };

  // 간호사별 통계 계산
  const getNurseStats = (nurseId: number) => {
    const counts: Record<string, number> = { D: 0, E: 0, N: 0, O: 0, X: 0 };
    for (const date of dates) {
      const shift = entryMap.get(`${nurseId}-${date}`) || 'O';
      counts[shift] = (counts[shift] || 0) + 1;
    }
    return counts;
  };

  const hardViolationCount = violations.filter(v => v.type === 'HARD').length;

  return (
    <div>
      <div className="page-header">
        <h1>
          {schedule.yearMonth} 근무표
          <span className={`badge badge-${schedule.status.toLowerCase()}`} style={{ marginLeft: '0.75rem', fontSize: '0.75rem' }}>
            {schedule.status === 'DRAFT' ? '작성중' : '확정'}
          </span>
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={handleExport}>Excel 내보내기</button>
          <button className="btn btn-outline" onClick={() => navigate(`/stats/${id}`)}>통계</button>
          {isAdmin && schedule.status === 'DRAFT' && (
            <button className="btn btn-success" onClick={handleConfirm}>확정</button>
          )}
        </div>
      </div>

      {hardViolationCount > 0 && (
        <div style={{ background: '#F8D7DA', color: '#721C24', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          하드 제약 위반 {hardViolationCount}건이 있습니다. 수정이 필요합니다.
        </div>
      )}

      {/* 셀 수정 모달 */}
      {editCell && (
        <div className="modal-overlay" onClick={() => setEditCell(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 'auto' }}>
            <div className="modal-title">근무 변경</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: '1rem' }}>
              {nurseList.find(n => n.id === editCell.nurseId)?.name} / {editCell.date}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {SHIFT_OPTIONS.map(s => (
                <button
                  key={s}
                  className={`shift-cell ${s}`}
                  style={{ width: 48, height: 40, fontSize: '1rem' }}
                  onClick={() => handleShiftChange(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 근무표 테이블 */}
      <div className="card" style={{ padding: '0.75rem', overflow: 'auto' }}>
        <table style={{ fontSize: '0.75rem' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--gray-100)', zIndex: 2, minWidth: 80 }}>간호사</th>
              {dates.map(date => {
                const d = new Date(date);
                const dayNum = d.getDate();
                const dayName = DAY_NAMES[d.getDay()];
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={date} style={{ textAlign: 'center', minWidth: 36, color: isWeekend ? 'var(--danger)' : undefined }}>
                    <div>{dayNum}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 400 }}>{dayName}</div>
                  </th>
                );
              })}
              <th style={{ textAlign: 'center' }}>D</th>
              <th style={{ textAlign: 'center' }}>E</th>
              <th style={{ textAlign: 'center' }}>N</th>
              <th style={{ textAlign: 'center' }}>O</th>
            </tr>
          </thead>
          <tbody>
            {nurseList.map(nurse => {
              const stats = getNurseStats(nurse.id);
              return (
                <tr key={nurse.id}>
                  <td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {nurse.name}
                  </td>
                  {dates.map(date => {
                    const shift = entryMap.get(`${nurse.id}-${date}`) || '';
                    const hasViolation = violationSet.has(`${nurse.id}-${date}`);
                    return (
                      <td key={date} style={{ padding: '2px', textAlign: 'center' }}>
                        {shift && (
                          <div
                            className={`shift-cell ${shift} ${hasViolation ? 'violation' : ''}`}
                            onClick={() => handleCellClick(nurse.id, date)}
                            title={hasViolation ? '제약 조건 위반' : undefined}
                          >
                            {shift}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--shift-d)' }}>{stats.D}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--shift-e)' }}>{stats.E}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--shift-n)' }}>{stats.N}</td>
                  <td style={{ textAlign: 'center', color: 'var(--gray-500)' }}>{stats.O}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 위반 사항 목록 */}
      {violations.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-title">제약 조건 검증 결과</div>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {violations.filter(v => v.type === 'HARD').map((v, i) => (
              <div key={i} style={{ padding: '0.375rem 0', fontSize: '0.8rem', color: 'var(--danger)', borderBottom: '1px solid var(--gray-100)' }}>
                [{v.ruleId}] {v.message}
              </div>
            ))}
            {violations.filter(v => v.type === 'SOFT').slice(0, 20).map((v, i) => (
              <div key={i} style={{ padding: '0.375rem 0', fontSize: '0.8rem', color: 'var(--gray-600)', borderBottom: '1px solid var(--gray-100)' }}>
                [{v.ruleId}] {v.message} (penalty: {v.penalty})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
