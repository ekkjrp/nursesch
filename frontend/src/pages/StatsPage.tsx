import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { schedules as schedulesApi } from '../api.ts';

// 통계 및 공정성 대시보드 (designreq.md FR-8)
export function StatsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any>(null);

  useEffect(() => {
    schedulesApi.get(Number(id)).then(setSchedule).catch(() => {});
    schedulesApi.stats(Number(id)).then(setStats).catch(() => {});
  }, [id]);

  if (!stats.length) return <div className="loading">로딩 중...</div>;

  // 전체 통계 계산
  const totalNurses = stats.length;
  const avgWork = (stats.reduce((s, n) => s + n.totalWorkDays, 0) / totalNurses).toFixed(1);
  const avgOff = (stats.reduce((s, n) => s + n.offDays, 0) / totalNurses).toFixed(1);
  const totalRequests = stats.reduce((s, n) => s + n.requestCount, 0);
  const totalFulfilled = stats.reduce((s, n) => s + n.requestFulfilled, 0);
  const fulfillRate = totalRequests > 0 ? Math.round((totalFulfilled / totalRequests) * 100) : 100;

  // D/E/N 편차 계산
  const calcStdDev = (key: string) => {
    const values = stats.map(s => s.shiftCounts[key] || 0);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance).toFixed(1);
  };

  return (
    <div>
      <div className="page-header">
        <h1>{schedule?.yearMonth} 통계 대시보드</h1>
        <button className="btn btn-outline" onClick={() => navigate(`/schedule/${id}`)}>근무표 보기</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{totalNurses}명</div>
          <div className="stat-label">간호사 수</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgWork}일</div>
          <div className="stat-label">평균 근무일</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgOff}일</div>
          <div className="stat-label">평균 휴무일</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: fulfillRate >= 80 ? 'var(--success)' : 'var(--danger)' }}>
            {fulfillRate}%
          </div>
          <div className="stat-label">요청 반영률</div>
        </div>
      </div>

      {/* 공정성 지표: 근무 유형별 편차 */}
      <div className="card">
        <div className="card-title">공정성 지표 (근무 유형별 표준편차)</div>
        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem' }}>
          <div>
            <span style={{ color: 'var(--shift-d)', fontWeight: 700 }}>D</span> 편차: {calcStdDev('D')}
          </div>
          <div>
            <span style={{ color: 'var(--shift-e)', fontWeight: 700 }}>E</span> 편차: {calcStdDev('E')}
          </div>
          <div>
            <span style={{ color: 'var(--shift-n)', fontWeight: 700 }}>N</span> 편차: {calcStdDev('N')}
          </div>
        </div>
      </div>

      {/* 간호사별 상세 통계 */}
      <div className="card">
        <div className="card-title">간호사별 상세 통계</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th style={{ textAlign: 'center', color: 'var(--shift-d)' }}>D</th>
                <th style={{ textAlign: 'center', color: 'var(--shift-e)' }}>E</th>
                <th style={{ textAlign: 'center', color: 'var(--shift-n)' }}>N</th>
                <th style={{ textAlign: 'center' }}>O</th>
                <th style={{ textAlign: 'center' }}>총 근무</th>
                <th style={{ textAlign: 'center' }}>주말 근무</th>
                <th style={{ textAlign: 'center' }}>요청 반영</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.nurseId}>
                  <td style={{ fontWeight: 600 }}>{s.nurseName}</td>
                  <td style={{ textAlign: 'center' }}>{s.shiftCounts.D}</td>
                  <td style={{ textAlign: 'center' }}>{s.shiftCounts.E}</td>
                  <td style={{ textAlign: 'center' }}>{s.shiftCounts.N}</td>
                  <td style={{ textAlign: 'center' }}>{s.shiftCounts.O}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.totalWorkDays}</td>
                  <td style={{ textAlign: 'center' }}>{s.weekendWorkDays}</td>
                  <td style={{ textAlign: 'center' }}>
                    {s.requestCount > 0
                      ? `${s.requestFulfilled}/${s.requestCount}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 근무 분포 바 차트 (간단한 CSS 바) */}
      <div className="card">
        <div className="card-title">근무 분포</div>
        {stats.map(s => {
          const total = s.shiftCounts.D + s.shiftCounts.E + s.shiftCounts.N + s.shiftCounts.O;
          return (
            <div key={s.nurseId} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>{s.nurseName}</div>
              <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(s.shiftCounts.D / total) * 100}%`, background: 'var(--shift-d)' }} title={`D: ${s.shiftCounts.D}`} />
                <div style={{ width: `${(s.shiftCounts.E / total) * 100}%`, background: 'var(--shift-e)' }} title={`E: ${s.shiftCounts.E}`} />
                <div style={{ width: `${(s.shiftCounts.N / total) * 100}%`, background: 'var(--shift-n)' }} title={`N: ${s.shiftCounts.N}`} />
                <div style={{ width: `${(s.shiftCounts.O / total) * 100}%`, background: 'var(--shift-o)' }} title={`O: ${s.shiftCounts.O}`} />
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'var(--shift-d)', borderRadius: 2, marginRight: 4 }} />D 낮번</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'var(--shift-e)', borderRadius: 2, marginRight: 4 }} />E 저녁번</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'var(--shift-n)', borderRadius: 2, marginRight: 4 }} />N 밤번</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'var(--shift-o)', borderRadius: 2, marginRight: 4 }} />O 휴무</span>
        </div>
      </div>
    </div>
  );
}
