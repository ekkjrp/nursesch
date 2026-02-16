import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { schedules as schedulesApi } from '../api.ts';

export function SchedulePage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generating, setGenerating] = useState(false);

  const loadSchedules = () => {
    if (user) schedulesApi.list(user.wardId).then(setList).catch(() => {});
  };

  useEffect(loadSchedules, [user]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await schedulesApi.generate(user!.wardId, yearMonth);
      navigate(`/schedule/${result.schedule.id}`);
    } catch (err: any) {
      alert(err.message || '근무표 생성 실패');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>근무표</h1>
      </div>

      {isAdmin && (
        <div className="card">
          <div className="card-title">근무표 자동 생성</div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>대상 연월</label>
              <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? '생성 중...' : '자동 생성'}
            </button>
          </div>
          {generating && (
            <p style={{ marginTop: '0.75rem', color: 'var(--gray-600)', fontSize: '0.85rem' }}>
              SA 알고리즘으로 최적 근무표를 생성하고 있습니다...
            </p>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">근무표 목록</div>
        {list.length === 0 ? (
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>근무표가 없습니다.</p>
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
              {list.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.yearMonth}</td>
                  <td>
                    <span className={`badge badge-${s.status.toLowerCase()}`}>
                      {s.status === 'DRAFT' ? '작성중' : '확정'}
                    </span>
                  </td>
                  <td>{new Date(s.createdAt).toLocaleDateString('ko')}</td>
                  <td style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/schedule/${s.id}`)}>보기</button>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/stats/${s.id}`)}>통계</button>
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
