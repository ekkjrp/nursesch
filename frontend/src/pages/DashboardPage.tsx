import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { schedules as schedulesApi, wards as wardsApi, nurses as nursesApi } from '../api.ts';

export default function DashboardPage() {
  const { nurse, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ wardName: '—', nurseCount: 0, scheduleCount: 0, draftCount: 0 });
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);

  useEffect(() => {
    if (!nurse) return;
    Promise.all([
      wardsApi.list(),
      nursesApi.list(nurse.ward_id),
      schedulesApi.list(nurse.ward_id),
    ]).then(([wardList, nurseList, schedList]) => {
      const ward = wardList.find((w: any) => w.id === nurse.ward_id);
      setStats({
        wardName: ward?.name || '—',
        nurseCount: nurseList.length,
        scheduleCount: schedList.length,
        draftCount: schedList.filter((s: any) => s.status === 'DRAFT').length,
      });
      setRecentSchedules(schedList.slice(0, 5));
    }).catch(() => {});
  }, [nurse]);

  const GRADE_LABEL: Record<string, string> = { HN: '수간호사', CN: '책임간호사', RN: '평간호사', AN: '보조간호사' };

  return (
    <div className="page">
      <div className="page-header">
        <h2>대시보드</h2>
        <div style={{ color: '#888', fontSize: 14 }}>
          {nurse?.name} ({nurse?.grade && GRADE_LABEL[nurse.grade]})
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">병동</div>
          <div className="stat-value">{stats.wardName}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">간호사 수</div>
          <div className="stat-value">{stats.nurseCount}명</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">전체 근무표</div>
          <div className="stat-value">{stats.scheduleCount}개</div>
        </div>
        <div className="stat-card" style={{ borderLeft: stats.draftCount > 0 ? '4px solid #E67E22' : undefined }}>
          <div className="stat-label">작성중</div>
          <div className="stat-value" style={{ color: stats.draftCount > 0 ? '#E67E22' : undefined }}>{stats.draftCount}개</div>
        </div>
      </div>

      {isAdmin && (
        <div className="quick-actions" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/nurses')}>간호사 관리</button>
          <button className="btn btn-secondary" onClick={() => navigate('/rules')}>근무 규칙 설정</button>
          <button className="btn btn-secondary" onClick={() => navigate('/schedules')}>근무표 생성</button>
          <button className="btn btn-secondary" onClick={() => navigate('/requests')}>근무 요청 관리</button>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">최근 근무표</h3>
        {recentSchedules.length === 0 ? (
          <p style={{ color: '#aaa' }}>생성된 근무표가 없습니다.</p>
        ) : (
          <table className="table">
            <thead><tr><th>연월</th><th>상태</th><th>생성일</th><th></th></tr></thead>
            <tbody>
              {recentSchedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.year_month}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12,
                      background: s.status === 'CONFIRMED' ? '#EAFAF1' : '#EAF2F8',
                      color: s.status === 'CONFIRMED' ? '#1E8449' : '#1A5276' }}>
                      {s.status === 'CONFIRMED' ? '확정' : '작성중'}
                    </span>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString('ko-KR')}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => navigate(`/schedules/${s.id}`)}>보기</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
