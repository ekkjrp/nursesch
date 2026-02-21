import { useEffect, useState } from 'react';
import { rules as rulesApi, nurses as nursesApi, holidays as holidaysApi } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

const SHIFT_TIME_INFO: Record<string, { time: string; color: string; bg: string }> = {
  D: { time: '07:00~16:00', color: 'var(--shift-d)', bg: 'var(--shift-d-bg)' },
  E: { time: '13:00~22:00', color: 'var(--shift-e)', bg: 'var(--shift-e-bg)' },
  N: { time: '21:30~08:30', color: 'var(--shift-n)', bg: 'var(--shift-n-bg)' },
  M: { time: '09:00~18:00', color: 'var(--shift-m)', bg: 'var(--shift-m-bg)' },
};

export default function RulesPage() {
  const { nurse: currentNurse } = useAuth();
  const [rule, setRule] = useState<any>(null);
  const [nurseList, setNurseList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [holidayList, setHolidayList] = useState<any[]>([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [holidayLoading, setHolidayLoading] = useState(false);

  const wardId = currentNurse?.ward_id;

  useEffect(() => {
    if (!wardId) return;
    Promise.all([
      rulesApi.get(wardId),
      nursesApi.list(wardId),
      holidaysApi.list(wardId),
    ]).then(([r, n, h]) => { setRule(r); setNurseList(n); setHolidayList(h); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [wardId]);

  const handleSave = async () => {
    if (!wardId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await rulesApi.update(wardId, rule);
      setRule(updated);
      setSuccess('규칙이 성공적으로 저장되었습니다.');
      // Auto dismiss success message
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: any) => setRule((r: any) => ({ ...r, [key]: value }));

  const handleAutoFillHolidays = async () => {
    if (!wardId) return;
    setHolidayLoading(true);
    setError('');
    try {
      const created = await holidaysApi.autoFill(wardId, holidayYear);
      if (created.length === 0) {
        setSuccess(`${holidayYear}년 공휴일이 이미 모두 등록되어 있습니다.`);
      } else {
        setSuccess(`${holidayYear}년 한국 공휴일 ${created.length}건이 등록되었습니다.`);
      }
      setHolidayList(await holidaysApi.list(wardId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setHolidayLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!wardId) return;
    try {
      await holidaysApi.delete(id);
      setHolidayList((prev) => prev.filter((h) => h.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div className="page"><div className="loading" /></div>;
  if (!rule) return <div className="page"><div className="card" style={{ textAlign: 'center', padding: 40 }}>규칙을 불러올 수 없습니다.</div></div>;

  const dedicatedNurses = nurseList.filter((n) => n.dedicated_shift);
  const DEDICATED_LABELS: Record<string, string> = { D: '데이', E: '이브닝', N: '나이트', M: '미드' };
  const DEDICATED_COLORS: Record<string, string> = { D: 'var(--shift-d)', E: 'var(--shift-e)', N: 'var(--shift-n)', M: 'var(--shift-m)' };

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem' }}>⚙️ 근무 규칙 설정</h2>
          <p style={{ color: 'var(--text-secondary)' }}>근무표 생성에 적용되는 제약 조건을 설정합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '12px 24px', fontSize: '1rem' }}>
          {saving ? '저장 중...' : '💾 규칙 저장'}
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: 24, padding: 16, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, color: 'var(--danger)' }}>{error}</div>}

      {success && (
        <div style={{
          marginBottom: 24, padding: 16, background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, color: 'var(--success)',
          display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeIn 0.3s ease'
        }}>
          <span style={{ fontSize: '1.2rem' }}>✓</span> {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
        {/* Left Column: Basic Constraints */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 className="card-title">📋 기본 제약 조건</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>최대 연속 근무일 수</label>
              <input type="number" className="form-control" min={1} max={14}
                value={rule.max_consecutive_work_days}
                onChange={(e) => set('max_consecutive_work_days', +e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>최대 연속 나이트 수</label>
              <input type="number" className="form-control" min={1} max={7}
                value={rule.max_consecutive_night_shifts}
                onChange={(e) => set('max_consecutive_night_shifts', +e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>월간 최소 휴무일 수</label>
              <input type="number" className="form-control" min={0}
                value={rule.min_monthly_off_days}
                onChange={(e) => set('min_monthly_off_days', +e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>최대 월간 나이트 근무일수 (0=무제한)</label>
              <input type="number" className="form-control" min={0}
                value={rule.max_monthly_night_shifts ?? 0}
                onChange={(e) => set('max_monthly_night_shifts', +e.target.value)} />
            </div>
          </div>

          <h3 className="card-title" style={{ marginTop: 32 }}>🕐 근무 시간 정보</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(SHIFT_TIME_INFO).map(([shift, info]) => (
              <div key={shift} style={{
                padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-light)'
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, background: info.color,
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.75rem', border: `1px solid ${info.color}`
                }}>{shift}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{info.time}</span>
              </div>
            ))}
          </div>

          <h3 className="card-title" style={{ marginTop: 32 }}>🔄 근무 전환 금지</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>나이트(N) → 데이(D) 허용</span>
              <label className="toggle">
                <input type="checkbox" checked={rule.allow_night_to_day} onChange={(e) => set('allow_night_to_day', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>나이트(N) → 이브닝(E) 허용</span>
              <label className="toggle">
                <input type="checkbox" checked={rule.allow_night_to_evening} onChange={(e) => set('allow_night_to_evening', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
              <span style={{ fontSize: '0.9rem' }}>나이트(N) → Off → 데이(D) 허용</span>
              <label className="toggle">
                <input type="checkbox" checked={rule.allow_night_off_day} onChange={(e) => set('allow_night_off_day', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.9rem' }}>AN (보조) 주말 자동 Off</span>
                <label className="toggle">
                  <input type="checkbox" checked={rule.an_auto_weekend_off} onChange={(e) => set('an_auto_weekend_off', e.target.checked)} />
                  <span className="slider"></span>
                </label>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                설정 시 보조간호사(AN)는 별도 지정이 없으면 토/일요일에 자동으로 휴무(Off)가 배정됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Staffing & Holidays */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card">
            <h3 className="card-title">👥 필요 인원 설정</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8 }}>
              <b>Charge</b>: 책임간호사 (HN/CN) 이상 필수 포함 인원<br />
              <b>Action</b>: 평간호사 (RN) 이상 필수 포함 인원
            </p>

            <h4 style={{ fontSize: '0.9rem', marginBottom: 12, color: 'var(--text-primary)' }}>평일 (Weekday)</h4>
            <div className="table-container" style={{ marginBottom: 20 }}>
              <table className="table table-compact">
                <thead><tr><th>근무</th><th>Charge</th><th>Action</th></tr></thead>
                <tbody>
                  {[
                    ['데이 (D)', 'weekday_day_charge', 'weekday_day_action', 'var(--shift-d)'],
                    ['이브닝 (E)', 'weekday_evening_charge', 'weekday_evening_action', 'var(--shift-e)'],
                    ['나이트 (N)', 'weekday_night_charge', 'weekday_night_action', 'var(--shift-n)'],
                  ].map(([label, ck, ak, color]) => (
                    <tr key={ck as string}>
                      <td>
                        <span style={{ display: 'inline-block', width: 4, height: 16, borderRadius: 2, background: color as string, marginRight: 8, verticalAlign: 'middle' }} />
                        {label}
                      </td>
                      <td><input type="number" className="form-control input-sm" min={0} value={rule[ck as string]} onChange={(e) => set(ck as string, +e.target.value)} /></td>
                      <td><input type="number" className="form-control input-sm" min={0} value={rule[ak as string]} onChange={(e) => set(ak as string, +e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 style={{ fontSize: '0.9rem', marginBottom: 12, color: 'var(--text-primary)' }}>주말/공휴일 (Weekend/Holiday)</h4>
            <div className="table-container">
              <table className="table table-compact">
                <thead><tr><th>근무</th><th>Charge</th><th>Action</th></tr></thead>
                <tbody>
                  {[
                    ['데이 (D)', 'weekend_day_charge', 'weekend_day_action', 'var(--shift-d)'],
                    ['이브닝 (E)', 'weekend_evening_charge', 'weekend_evening_action', 'var(--shift-e)'],
                    ['나이트 (N)', 'weekend_night_charge', 'weekend_night_action', 'var(--shift-n)'],
                  ].map(([label, ck, ak, color]) => (
                    <tr key={ck as string}>
                      <td>
                        <span style={{ display: 'inline-block', width: 4, height: 16, borderRadius: 2, background: color as string, marginRight: 8, verticalAlign: 'middle' }} />
                        {label}
                      </td>
                      <td><input type="number" className="form-control input-sm" min={0} value={rule[ck as string]} onChange={(e) => set(ck as string, +e.target.value)} /></td>
                      <td><input type="number" className="form-control input-sm" min={0} value={rule[ak as string]} onChange={(e) => set(ak as string, +e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">🎯 지정근무 (Dedicated)</h3>
            {dedicatedNurses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                지정근무자가 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dedicatedNurses.map((n) => (
                  <div key={n.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 10, fontSize: '0.85rem',
                    border: '1px solid var(--border-light)'
                  }}>
                    <span className={`badge badge-grade-${n.grade.toLowerCase()}`}>{n.grade}</span>
                    <span style={{ fontWeight: 600 }}>{n.name}</span>
                    <span style={{ marginLeft: 'auto', color: DEDICATED_COLORS[n.dedicated_shift], fontWeight: 700 }}>
                      {n.dedicated_shift} ({DEDICATED_LABELS[n.dedicated_shift]}) 전담
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">🎌 공휴일 관리</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <select className="form-control" style={{ width: 100 }} value={holidayYear} onChange={(e) => setHolidayYear(+e.target.value)}>
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() + i - 1;
                  return <option key={y} value={y}>{y}년</option>;
                })}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={handleAutoFillHolidays} disabled={holidayLoading} style={{ flex: 1 }}>
                {holidayLoading ? '등록 중...' : '공휴일 자동등록'}
              </button>
            </div>

            <div style={{ maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
              {holidayList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  등록된 공휴일이 없습니다.
                </div>
              ) : (
                <table className="table table-compact">
                  <thead><tr><th>날짜</th><th>이름</th><th>삭제</th></tr></thead>
                  <tbody>
                    {holidayList
                      .sort((a: any, b: any) => a.date.localeCompare(b.date))
                      .map((h: any) => (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 500 }}>{h.date}</td>
                          <td style={{ fontSize: '0.85rem' }}>{h.name}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-sm" style={{ color: 'var(--danger)', opacity: 0.8, padding: '2px 8px' }} onClick={() => handleDeleteHoliday(h.id)}>×</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
