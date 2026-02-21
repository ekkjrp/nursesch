import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { schedules as schedulesApi, nurses as nursesApi } from '../api.ts';

const SHIFT_LABELS: Record<string, string> = { D: '데이', E: '이브닝', N: '나이트', M: '미드', O: '오프', Y: '연차', X: '기타' };
const SHIFT_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  D: { bg: 'var(--shift-d-bg)', text: 'var(--shift-d)', bar: 'var(--shift-d)' },
  E: { bg: 'var(--shift-e-bg)', text: 'var(--shift-e)', bar: 'var(--shift-e)' },
  N: { bg: 'var(--shift-n-bg)', text: 'var(--shift-n)', bar: 'var(--shift-n)' },
  M: { bg: 'var(--shift-m-bg)', text: 'var(--shift-m)', bar: 'var(--shift-m)' },
  O: { bg: 'var(--shift-o-bg)', text: 'var(--shift-o)', bar: 'var(--shift-o)' },
  Y: { bg: 'rgba(234, 179, 8, 0.15)', text: 'rgb(234, 179, 8)', bar: 'rgb(234, 179, 8)' },
};

export default function StatsPage() {
  const { nurse: currentNurse } = useAuth();
  const [scheduleList, setScheduleList] = useState<any[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [nurseMap, setNurseMap] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentNurse) return;
    Promise.all([
      schedulesApi.list(currentNurse.ward_id),
      nursesApi.list(currentNurse.ward_id),
    ]).then(([scheds, nurses]) => {
      setScheduleList(scheds);
      setNurseMap(new Map(nurses.map((n: any) => [n.id, n])));
      if (scheds.length > 0) setSelectedScheduleId(scheds[0].id);
    }).finally(() => setLoading(false));
  }, [currentNurse]);

  useEffect(() => {
    if (selectedScheduleId) {
      schedulesApi.get(selectedScheduleId).then((data) => setEntries(data.entries || []));
    }
  }, [selectedScheduleId]);

  // Build stats per nurse
  type NurseStats = { nurseId: number; D: number; E: number; N: number; M: number; O: number; Y: number; total: number; workDays: number };
  const nurseStats: NurseStats[] = [];
  const nurseIds = new Set<number>();
  entries.forEach((e) => nurseIds.add(e.nurse_id));

  nurseIds.forEach((nid) => {
    const ns: NurseStats = { nurseId: nid, D: 0, E: 0, N: 0, M: 0, O: 0, Y: 0, total: 0, workDays: 0 };
    entries.filter((e) => e.nurse_id === nid).forEach((e) => {
      const s = e.shift_type;
      if (ns[s as keyof NurseStats] !== undefined) (ns as any)[s]++;
      ns.total++;
      if (['D', 'E', 'N', 'M'].includes(s)) ns.workDays++;
    });
    nurseStats.push(ns);
  });

  // Sort by nurse sort_order / grade
  const GRADE_ORD: Record<string, number> = { HN: 0, CN: 1, RN: 2, AN: 3, PN: 4 };
  nurseStats.sort((a, b) => {
    const na = nurseMap.get(a.nurseId);
    const nb = nurseMap.get(b.nurseId);
    const ga = GRADE_ORD[na?.grade] ?? 9;
    const gb = GRADE_ORD[nb?.grade] ?? 9;
    if (ga !== gb) return ga - gb;
    return (na?.sort_order || 99) - (nb?.sort_order || 99);
  });

  // Summary stats
  const totalNurses = nurseStats.length;
  const avgWorkDays = totalNurses > 0 ? (nurseStats.reduce((s, n) => s + n.workDays, 0) / totalNurses).toFixed(1) : '—';
  const totalOffDays = nurseStats.reduce((s, n) => s + n.O, 0);
  const maxWork = Math.max(...nurseStats.map((n) => n.workDays), 1);
  const minWork = Math.min(...nurseStats.map((n) => n.workDays), 0);
  const fairness = maxWork > 0 ? (100 - ((maxWork - minWork) / maxWork) * 100).toFixed(0) : '—';

  if (loading) return <div className="page"><div className="loading" /></div>;

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.5rem' }}>📈 근무 통계</h2>
        <p style={{ color: 'var(--text-secondary)' }}>월별 근무 통계 및 공정성 지표를 확인합니다.</p>
      </div>

      {/* Schedule Selector */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>근무표 선택:</span>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {scheduleList.map((s) => (
            <button key={s.id}
              className={`btn btn-sm ${selectedScheduleId === s.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedScheduleId(s.id)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {s.year_month}
              {s.status === 'CONFIRMED' && <span style={{ marginLeft: 6, opacity: 0.8 }}>✓</span>}
            </button>
          ))}
          {scheduleList.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>생성된 근무표가 없습니다</span>}
        </div>
      </div>

      {selectedScheduleId && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-light)', marginBottom: 4 }}>{totalNurses}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>간호사 수</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{avgWorkDays}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>평균 근무일</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)', marginBottom: 4 }}>{totalOffDays}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>총 OFF일</div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--warning)', marginBottom: 4 }}>{fairness}%</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>공정성 지수</div>
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title">📊 근무 분포 (Day 기준)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
              {nurseStats.map((ns) => {
                const nurse = nurseMap.get(ns.nurseId);
                const maxVal = Math.max(...nurseStats.map((n) => n.D), 1);
                const pct = maxVal > 0 ? (ns.D / maxVal) * 100 : 0;
                return (
                  <div key={ns.nurseId} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 100, textAlign: 'right', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      <span className={`badge badge-grade-${(nurse?.grade || 'rn').toLowerCase()}`}
                        style={{ fontSize: '0.65rem', marginRight: 6 }}>
                        {nurse?.grade}
                      </span>
                      {nurse?.name}
                    </div>
                    <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        height: '100%', borderRadius: 6, width: `${pct}%`,
                        background: 'linear-gradient(90deg, var(--shift-d) 0%, #60a5fa 100%)',
                        boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)',
                        transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }} />
                    </div>
                    <div style={{ width: 30, textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: 'var(--shift-d)' }}>
                      {ns.D}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>간호사</th>
                  <th>직급</th>
                  {['D', 'E', 'N', 'M', 'O', 'Y'].map((s) => (
                    <th key={s} style={{ background: (SHIFT_COLORS[s] as any)?.bg, color: (SHIFT_COLORS[s] as any)?.text, textAlign: 'center' }}>
                      {s}
                      <div style={{ fontSize: '0.65rem', fontWeight: 400, opacity: 0.8 }}>{SHIFT_LABELS[s]}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>근무일</th>
                  <th style={{ textAlign: 'center', paddingRight: 24 }}>총계</th>
                </tr>
              </thead>
              <tbody>
                {nurseStats.map((ns) => {
                  const nurse = nurseMap.get(ns.nurseId);
                  return (
                    <tr key={ns.nurseId}>
                      <td style={{ fontWeight: 600, paddingLeft: 24 }}>{nurse?.name}</td>
                      <td><span className={`badge badge-grade-${(nurse?.grade || 'rn').toLowerCase()}`}>{nurse?.grade}</span></td>
                      {['D', 'E', 'N', 'M', 'O', 'Y'].map((s) => (
                        <td key={s} style={{
                          textAlign: 'center', fontWeight: 600,
                          background: (ns as any)[s] > 0 ? (SHIFT_COLORS[s] as any)?.bg : 'transparent',
                          color: (ns as any)[s] > 0 ? (SHIFT_COLORS[s] as any)?.text : 'var(--text-muted)',
                        }}>
                          {(ns as any)[s] || <span style={{ opacity: 0.1 }}>-</span>}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary-light)', borderLeft: '1px solid var(--border)' }}>{ns.workDays}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)', paddingRight: 24 }}>{ns.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
