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
    if (nurse) schedulesApi.list(nurse.ward_id).then(setList).catch(() => { });
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
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '1.5rem' }}>📋 근무표 관리</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>월별 근무표를 생성하고 관리합니다.</p>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: 40, border: '1px solid var(--primary-dark)', background: 'linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(30,27,75,0.4) 100%)' }}>
          <h3 className="card-title" style={{ color: 'var(--primary-light)' }}>
            <span style={{ marginRight: 8 }}>⚡</span>
            새 근무표 자동 생성
          </h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>대상 연월</label>
              <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'var(--border-glow)' }} />
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}
              style={{ minWidth: 160, height: 48, fontSize: '1rem' }}>
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 18, height: 18, border: '3px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite'
                  }} />
                  생성 중...
                </span>
              ) : '✨ AI 자동 생성'}
            </button>
          </div>

          {error && <div className="alert-error" style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'rgba(244,63,94,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,63,94,0.2)' }}>{error}</div>}

          {genResult && (
            <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: genResult.hard_violations > 0 ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)', border: '1px solid currentColor', color: genResult.hard_violations > 0 ? 'var(--danger)' : 'var(--success)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
                {genResult.hard_violations > 0 ? '⚠️ 생성 완료 (위반사항 있음)' : '✅ 완벽하게 생성됨!'}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                하드 위반: {genResult.hard_violations}건 · 점수: {genResult.score?.toFixed(1)}점
              </div>
              {genResult.hard_violations > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                  {genResult.violations?.slice(0, 5).map((v: any, i: number) => (
                    <div key={i} style={{ fontSize: '0.85rem', marginBottom: 4 }}>• {v.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '1.2rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📅</span>
          <span>생성 내역</span>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>{list.length}</span>
        </h3>

        {list.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.5 }}>📭</div>
            <p style={{ fontSize: '1rem', marginBottom: 8 }}>생성된 근무표가 없습니다.</p>
            {isAdmin && <p style={{ fontSize: '0.8rem' }}>상단의 패널을 통해 새로운 근무표를 생성해보세요.</p>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {list.map((s) => (
              <div key={s.id}
                className="card"
                onClick={() => navigate(`/schedules/${s.id}`)}
                style={{
                  padding: 24, cursor: 'pointer', margin: 0,
                  borderLeft: s.status === 'CONFIRMED' ? '4px solid var(--success)' : '4px solid var(--warning)',
                  display: 'flex', flexDirection: 'column', gap: 16
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                    {s.year_month}
                  </div>
                  <span className="badge" style={{
                    background: s.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: s.status === 'CONFIRMED' ? 'var(--success)' : 'var(--warning)',
                    padding: '6px 12px'
                  }}>
                    {s.status === 'CONFIRMED' ? '확정됨' : '작성중'}
                  </span>
                </div>

                <div style={{ height: 1, background: 'var(--border)', width: '100%' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>생성일</div>
                  <div>{new Date(s.created_at).toLocaleDateString('ko-KR')}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <span style={{ color: 'var(--primary-light)', fontSize: '0.9rem', fontWeight: 600 }}>상세보기 →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
