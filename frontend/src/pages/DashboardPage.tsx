import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { schedules as schedulesApi, wards as wardsApi, nurses as nursesApi } from '../api.ts';

export default function DashboardPage() {
  const { nurse, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ wardName: '—', nurseCount: 0, scheduleCount: 0, draftCount: 0, confirmedCount: 0 });
  const [recentSchedules, setRecentSchedules] = useState<any[]>([]);

  useEffect(() => {
    if (!nurse) return;
    Promise.all([
      wardsApi.list(),
      nursesApi.list(nurse.ward_id),
      schedulesApi.list(nurse.ward_id),
    ]).then(([wardList, nurseList, schedList]) => {
      const ward = wardList.find((w: any) => w.id === nurse.ward_id);
      const confirmed = schedList.filter((s: any) => s.status === 'CONFIRMED').length;
      setStats({
        wardName: ward?.name || '—',
        nurseCount: nurseList.length,
        scheduleCount: schedList.length,
        draftCount: schedList.filter((s: any) => s.status === 'DRAFT').length,
        confirmedCount: confirmed,
      });
      setRecentSchedules(schedList.slice(0, 5));
    }).catch(() => { });
  }, [nurse]);

  const GRADE_LABEL: Record<string, string> = { HN: '수간호사', CN: '책임간호사', RN: '평간호사', AN: '보조간호사', PN: '임시간호사' };

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthSchedule = recentSchedules.find(s => s.year_month === currentYM);
  const hour = now.getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '수고하셨습니다';

  return (
    <div className="page fade-in">
      {/* Hero Banner */}
      <div className="card" style={{
        background: 'rgba(255,255,255,0.4)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 8px 32px rgba(31, 38, 135, 0.05)',
        color: 'var(--text-primary)', padding: '40px', marginBottom: 32,
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Background Patterns */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, background: 'radial-gradient(circle, var(--primary-light) 0%, transparent 70%)', opacity: 0.15, borderRadius: '50%', filter: 'blur(20px)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: 50, width: 150, height: 150, background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)', opacity: 0.15, borderRadius: '50%', filter: 'blur(15px)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '2.4rem', marginBottom: 8, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {greeting}, <span style={{ color: 'var(--primary)' }}>{nurse?.name}</span>님 👋
          </h1>
          <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {stats.wardName} · {nurse?.grade && GRADE_LABEL[nurse.grade]}
          </div>
          <div style={{ marginTop: 24, display: 'inline-flex', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)', padding: '8px 16px', borderRadius: 50, fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 600, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            📅 오늘은 {now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}입니다
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Stats Grid */}
        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 4 }}>🏥</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>병동</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.wardName}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 4 }}>👩‍⚕️</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>간호사</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.nurseCount}명</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 4 }}>📋</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>전체 근무표</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.scheduleCount}개</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 4 }}>✏️</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>작성중</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.draftCount}개</div>
          </div>
        </div>

        {/* Current Month Status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 className="card-title">📅 이번 달 근무표</h3>
          {currentMonthSchedule ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <span className={`badge ${currentMonthSchedule.status === 'CONFIRMED' ? 'badge-grade' : 'badge-grade'}`}
                  style={{
                    fontSize: '1rem', padding: '8px 16px',
                    background: currentMonthSchedule.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: currentMonthSchedule.status === 'CONFIRMED' ? 'var(--success)' : 'var(--warning)',
                    border: '1px solid currentColor'
                  }}>
                  {currentMonthSchedule.status === 'CONFIRMED' ? '✓ 확정됨' : '● 작성 중'}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
                생성일: {new Date(currentMonthSchedule.created_at).toLocaleDateString('ko-KR')}
              </p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate(`/schedules/${currentMonthSchedule.id}`)}>
                근무표 확인하기 →
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
              <p style={{ marginBottom: 20 }}>아직 이번 달 근무표가 없습니다.</p>
              {isAdmin && (
                <button className="btn btn-primary" onClick={() => navigate('/schedules')}>
                  ➕ 새 근무표 생성
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {isAdmin && (
        <div className="card">
          <h3 className="card-title">⚡ 빠른 작업</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <button className="btn btn-secondary" onClick={() => navigate('/nurses')} style={{ justifyContent: 'flex-start', padding: '20px' }}>
              <span style={{ fontSize: '1.5rem', marginRight: 12 }}>👩‍⚕️</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>간호사 관리</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>인원 및 정보 수정</div>
              </div>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/rules')} style={{ justifyContent: 'flex-start', padding: '20px' }}>
              <span style={{ fontSize: '1.5rem', marginRight: 12 }}>⚙️</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>근무 규칙</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>제약 조건 설정</div>
              </div>
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/requests')} style={{ justifyContent: 'flex-start', padding: '20px' }}>
              <span style={{ fontSize: '1.5rem', marginRight: 12 }}>📝</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>근무 요청</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>휴가 및 근무 신청</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Recent Schedules List */}
      <div className="card">
        <h3 className="card-title">📜 최근 근무표 이력</h3>
        <div className="table-container">
          <table>
            <thead><tr><th>연월</th><th>상태</th><th>생성일</th><th>작업</th></tr></thead>
            <tbody>
              {recentSchedules.length > 0 ? recentSchedules.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.year_month}</td>
                  <td>
                    <span className="badge" style={{
                      background: s.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: s.status === 'CONFIRMED' ? 'var(--success)' : 'var(--warning)'
                    }}>
                      {s.status === 'CONFIRMED' ? '확정' : '작성중'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/schedules/${s.id}`)}>
                      상세보기
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    생성된 근무표가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
