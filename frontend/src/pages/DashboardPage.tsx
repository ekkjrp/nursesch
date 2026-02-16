import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { wards, schedules, nurses as nursesApi } from '../api.ts';

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [wardInfo, setWardInfo] = useState<any>(null);
  const [scheduleList, setScheduleList] = useState<any[]>([]);
  const [nurseCount, setNurseCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    wards.get(user.wardId).then(setWardInfo).catch(() => {});
    schedules.list(user.wardId).then(setScheduleList).catch(() => {});
    nursesApi.list(user.wardId).then(n => setNurseCount(n.length)).catch(() => {});
  }, [user]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentSchedule = scheduleList.find(s => s.yearMonth === currentMonth);

  return (
    <div>
      <div className="page-header">
        <h1>대시보드</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{wardInfo?.name || '-'}</div>
          <div className="stat-label">소속 병동</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{nurseCount}</div>
          <div className="stat-label">간호사 수</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{scheduleList.length}</div>
          <div className="stat-label">근무표 수</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {currentSchedule
              ? <span className={`badge badge-${currentSchedule.status.toLowerCase()}`}>{currentSchedule.status === 'DRAFT' ? '작성중' : '확정'}</span>
              : '미생성'}
          </div>
          <div className="stat-label">이번 달 근무표</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">최근 근무표</div>
        {scheduleList.length === 0 ? (
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {isAdmin ? '아직 생성된 근무표가 없습니다. 근무표 메뉴에서 새 근무표를 생성하세요.' : '아직 근무표가 없습니다.'}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>연월</th>
                <th>상태</th>
                <th>생성일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scheduleList.slice(0, 5).map(s => (
                <tr key={s.id}>
                  <td>{s.yearMonth}</td>
                  <td>
                    <span className={`badge badge-${s.status.toLowerCase()}`}>
                      {s.status === 'DRAFT' ? '작성중' : '확정'}
                    </span>
                  </td>
                  <td>{new Date(s.createdAt).toLocaleDateString('ko')}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/schedule/${s.id}`)}>
                      보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/schedule')}>근무표 생성</button>
          <button className="btn btn-outline" onClick={() => navigate('/nurses')}>간호사 관리</button>
          <button className="btn btn-outline" onClick={() => navigate('/rules')}>규칙 설정</button>
        </div>
      )}
    </div>
  );
}
