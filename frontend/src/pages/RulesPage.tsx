import { useEffect, useState } from 'react';
import { rules as rulesApi, nurses as nursesApi } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

export default function RulesPage() {
  const { nurse: currentNurse } = useAuth();
  const [rule, setRule] = useState<any>(null);
  const [nurseList, setNurseList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const wardId = currentNurse?.ward_id;

  useEffect(() => {
    if (!wardId) return;
    Promise.all([
      rulesApi.get(wardId),
      nursesApi.list(wardId),
    ]).then(([r, n]) => { setRule(r); setNurseList(n); })
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
      setSuccess('규칙이 저장되었습니다.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: any) => setRule((r: any) => ({ ...r, [key]: value }));

  if (loading) return <div className="page"><p>로딩 중...</p></div>;
  if (!rule) return <div className="page"><p>규칙을 불러올 수 없습니다.</p></div>;

  const nightDedicated = nurseList.filter((n) => n.is_night_dedicated);
  const regularNurses = nurseList.filter((n) => !n.is_night_dedicated);

  return (
    <div className="page">
      <div className="page-header">
        <h2>근무 규칙 설정</h2>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="rules-grid">
        {/* 좌측: 기본 설정 + 전환 규칙 */}
        <div className="card">
          <h3 className="card-title">기본 설정</h3>
          <div className="form-group">
            <label>최대 연속 근무일 수</label>
            <input type="number" className="form-control" min={1} max={14}
              value={rule.max_consecutive_work_days}
              onChange={(e) => set('max_consecutive_work_days', +e.target.value)} />
          </div>
          <div className="form-group">
            <label>최대 연속 나이트 수</label>
            <input type="number" className="form-control" min={1} max={7}
              value={rule.max_consecutive_night_shifts}
              onChange={(e) => set('max_consecutive_night_shifts', +e.target.value)} />
          </div>
          <div className="form-group">
            <label>월간 최소 휴무일 수</label>
            <input type="number" className="form-control" min={0}
              value={rule.min_monthly_off_days}
              onChange={(e) => set('min_monthly_off_days', +e.target.value)} />
          </div>

          <h3 className="card-title" style={{ marginTop: 24 }}>근무 전환 금지 패턴</h3>
          <div className="toggle-row">
            <span>N → 데이 허용</span>
            <label className="toggle">
              <input type="checkbox" checked={rule.allow_night_to_day}
                onChange={(e) => set('allow_night_to_day', e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
          <div className="toggle-row">
            <span>N → 이브닝 허용</span>
            <label className="toggle">
              <input type="checkbox" checked={rule.allow_night_to_evening}
                onChange={(e) => set('allow_night_to_evening', e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
          <div className="toggle-row">
            <span>N → 오프 → 데이 허용</span>
            <label className="toggle">
              <input type="checkbox" checked={rule.allow_night_off_day}
                onChange={(e) => set('allow_night_off_day', e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
          <div className="toggle-row">
            <span>AN 주말 자동 Off</span>
            <label className="toggle">
              <input type="checkbox" checked={rule.an_auto_weekend_off}
                onChange={(e) => set('an_auto_weekend_off', e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
          <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
            AN 주말 자동 Off: 보조간호사(AN)는 별도 지정 없으면 토/일 자동 휴무 처리됩니다.
          </p>
        </div>

        {/* 우측: 인원 설정 */}
        <div className="card">
          <h3 className="card-title">평일 인원 설정</h3>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            Charge = HN/CN (책임), Action = RN (일반 근무)
          </p>
          <table className="table table-compact">
            <thead><tr><th>근무</th><th>Charge</th><th>Action</th></tr></thead>
            <tbody>
              {[
                ['데이 (D)', 'weekday_day_charge', 'weekday_day_action'],
                ['이브닝 (E)', 'weekday_evening_charge', 'weekday_evening_action'],
                ['나이트 (N)', 'weekday_night_charge', 'weekday_night_action'],
              ].map(([label, ck, ak]) => (
                <tr key={ck}>
                  <td>{label}</td>
                  <td><input type="number" className="form-control input-sm" min={0} value={rule[ck]}
                    onChange={(e) => set(ck, +e.target.value)} /></td>
                  <td><input type="number" className="form-control input-sm" min={0} value={rule[ak]}
                    onChange={(e) => set(ak, +e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="card-title" style={{ marginTop: 20 }}>주말/공휴일 인원 설정</h3>
          <table className="table table-compact">
            <thead><tr><th>근무</th><th>Charge</th><th>Action</th></tr></thead>
            <tbody>
              {[
                ['데이 (D)', 'weekend_day_charge', 'weekend_day_action'],
                ['이브닝 (E)', 'weekend_evening_charge', 'weekend_evening_action'],
                ['나이트 (N)', 'weekend_night_charge', 'weekend_night_action'],
              ].map(([label, ck, ak]) => (
                <tr key={ck}>
                  <td>{label}</td>
                  <td><input type="number" className="form-control input-sm" min={0} value={rule[ck]}
                    onChange={(e) => set(ck, +e.target.value)} /></td>
                  <td><input type="number" className="form-control input-sm" min={0} value={rule[ak]}
                    onChange={(e) => set(ak, +e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="card-title" style={{ marginTop: 20 }}>나이트 전담 간호사</h3>
          {nightDedicated.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888' }}>
              나이트 전담 없음. 간호사 관리에서 "나이트 전담"으로 지정하세요.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
              {nightDedicated.map((n) => (
                <li key={n.id} style={{ color: '#9B59B6', marginBottom: 4 }}>
                  {n.name} ({n.grade}) — 나이트 전담
                </li>
              ))}
            </ul>
          )}
          {nightDedicated.length > 0 && (
            <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
              전담 간호사가 있으면 일반 간호사는 나이트에 자동 배정되지 않습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
