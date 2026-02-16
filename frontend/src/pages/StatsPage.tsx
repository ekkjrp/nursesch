import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { schedules as schedulesApi } from '../api.ts';

const GRADE_LABEL: Record<string, string> = { HN: '수간호사', CN: '책임간호사', RN: '평간호사', AN: '보조간호사' };

export default function StatsPage() {
  const { nurse } = useAuth();
  const [scheduleList, setScheduleList] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (nurse) schedulesApi.list(nurse.ward_id).then(setScheduleList).catch(() => {});
  }, [nurse]);

  const loadStats = async (id: number) => {
    setSelectedId(id);
    setLoading(true);
    try {
      const data = await schedulesApi.stats(id);
      setStats(data);
    } catch {}
    finally { setLoading(false); }
  };

  const selectedSchedule = scheduleList.find((s) => s.id === selectedId);

  return (
    <div className="page">
      <div className="page-header">
        <h2>통계 대시보드</h2>
        <select className="form-control" style={{ width: 160 }}
          value={selectedId || ''}
          onChange={(e) => loadStats(Number(e.target.value))}>
          <option value="">근무표 선택</option>
          {scheduleList.map((s) => (
            <option key={s.id} value={s.id}>{s.year_month} ({s.status === 'CONFIRMED' ? '확정' : '작성중'})</option>
          ))}
        </select>
      </div>

      {selectedSchedule && (
        <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
          {selectedSchedule.year_month} 근무표 통계
        </div>
      )}

      {loading ? <p>로딩 중...</p> : stats.length === 0 ? (
        <p style={{ color: '#aaa' }}>근무표를 선택하세요.</p>
      ) : (
        <div className="card">
          <h3 className="card-title">간호사별 근무 통계</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th><th>직급</th>
                  <th style={{ color: '#1A5276' }}>데이(D)</th>
                  <th style={{ color: '#1E8449' }}>이브닝(E)</th>
                  <th style={{ color: '#6C3483' }}>나이트(N)</th>
                  <th style={{ color: '#154360' }}>미드(M)</th>
                  <th style={{ color: '#566573' }}>오프(O)</th>
                  <th style={{ color: '#7D6608' }}>연차(Y)</th>
                  <th>총비근무</th>
                  <th>주말근무</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.nurse_id}>
                    <td>{s.nurse_name}</td>
                    <td><span style={{ fontSize: 12 }}>{s.grade} ({GRADE_LABEL[s.grade] || s.grade})</span></td>
                    <td style={{ textAlign: 'center', background: '#EBF5FB' }}>{s.d_count}</td>
                    <td style={{ textAlign: 'center', background: '#EAFAF1' }}>{s.e_count}</td>
                    <td style={{ textAlign: 'center', background: '#F4ECF7' }}>{s.n_count}</td>
                    <td style={{ textAlign: 'center', background: '#EAF2F8' }}>{s.m_count}</td>
                    <td style={{ textAlign: 'center', background: '#F2F3F4' }}>{s.o_count}</td>
                    <td style={{ textAlign: 'center', background: '#FEF9E7' }}>{s.y_count}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.total_off}</td>
                    <td style={{ textAlign: 'center' }}>{s.weekend_work}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 간단한 막대 차트 */}
          <h3 className="card-title" style={{ marginTop: 24 }}>데이 근무 분포</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {stats.map((s) => {
              const max = Math.max(...stats.map((x) => x.d_count), 1);
              const height = (s.d_count / max) * 80;
              return (
                <div key={s.nurse_id} style={{ textAlign: 'center', minWidth: 40 }}>
                  <div style={{ height: 80, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: 32, height, background: '#4A90D9', borderRadius: '3px 3px 0 0', margin: '0 auto' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#555' }}>{s.nurse_name.slice(0, 2)}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{s.d_count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
