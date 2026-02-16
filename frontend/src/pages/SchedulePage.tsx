import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { schedules as schedulesApi } from '../api.ts';

export default function SchedulePage() {
  const { nurse, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [genResult, setGenResult] = useState<any>(null);

  const loadSchedules = () => {
    if (nurse) schedulesApi.list(nurse.ward_id).then(setList).catch(() => {});
  };

  useEffect(loadSchedules, [nurse]);

  const handleGenerate = async () => {
    if (!nurse) return;
    setGenerating(true);
    setError('');
    setGenResult(null);
    try {
      const result = await schedulesApi.generate(nurse.ward_id, yearMonth);
      setGenResult(result);
      loadSchedules();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>근무표</h2>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title">근무표 자동 생성</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>대상 연월</label>
              <input type="month" className="form-control" value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? '생성 중... (10~30초 소요)' : '자동 생성'}
            </button>
          </div>
          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
          {genResult && (
            <div className={`alert ${genResult.hard_violations > 0 ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 12 }}>
              생성 완료 — 하드 위반: {genResult.hard_violations}건, 점수: {genResult.score?.toFixed(1)}
              {genResult.hard_violations > 0 && (
                <div style={{ marginTop: 8 }}>
                  {genResult.violations?.slice(0, 5).map((v: any, i: number) => (
                    <div key={i} style={{ fontSize: 12 }}>• {v.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="card-title">근무표 목록</h3>
        {list.length === 0 ? (
          <p style={{ color: '#aaa' }}>생성된 근무표가 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>연월</th><th>상태</th><th>생성일</th><th>보기</th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.year_month}</td>
                  <td>
                    <span className={s.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-draft'}
                      style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12,
                        background: s.status === 'CONFIRMED' ? '#EAFAF1' : '#EAF2F8',
                        color: s.status === 'CONFIRMED' ? '#1E8449' : '#1A5276' }}>
                      {s.status === 'CONFIRMED' ? '확정' : '작성중'}
                    </span>
                  </td>
                  <td>{new Date(s.created_at).toLocaleDateString('ko-KR')}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => navigate(`/schedules/${s.id}`)}>
                      보기
                    </button>
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
