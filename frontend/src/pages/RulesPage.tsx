import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { rules as rulesApi } from '../api.ts';

// 근무 규칙 설정 화면 (designreq.md 9.3 — MakeDuty 참고 2패널 레이아웃)
export function RulesPage() {
  const { user } = useAuth();
  const [rule, setRule] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) rulesApi.get(user.wardId).then(setRule).catch(() => {});
  }, [user]);

  const updateField = (field: string, value: any) => {
    setRule({ ...rule, [field]: value });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await rulesApi.update(user!.wardId, rule);
      setSaved(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!rule) return <div className="loading">로딩 중...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>근무 규칙 설정</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : saved ? '저장 완료' : '저장'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* 좌측 패널: 기본 설정 */}
        <div className="card">
          <div className="card-title">기본 설정</div>

          <div className="form-group">
            <label>최대 연속 근무일 수</label>
            <input type="number" min={1} max={10} value={rule.maxConsecutiveWorkDays}
              onChange={e => updateField('maxConsecutiveWorkDays', Number(e.target.value))} />
          </div>

          <div className="form-group">
            <label>최대 연속 야간근무(N) 수</label>
            <input type="number" min={1} max={7} value={rule.maxConsecutiveNightShifts}
              onChange={e => updateField('maxConsecutiveNightShifts', Number(e.target.value))} />
          </div>

          <div className="form-group">
            <label>월간 최소 휴무일 수</label>
            <input type="number" min={0} max={15} value={rule.minMonthlyOffDays}
              onChange={e => updateField('minMonthlyOffDays', Number(e.target.value))} />
          </div>

          <div className="card-title" style={{ marginTop: '1.5rem' }}>근무 전환 규칙</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Toggle
              label="N→D 허용 (밤번 후 낮번)"
              checked={rule.allowNightToDay}
              onChange={v => updateField('allowNightToDay', v)}
            />
            <Toggle
              label="N→E 허용 (밤번 후 저녁번)"
              checked={rule.allowNightToEvening}
              onChange={v => updateField('allowNightToEvening', v)}
            />
            <Toggle
              label="NOD 허용 (밤번→휴무→낮번)"
              checked={rule.allowNightOffDay}
              onChange={v => updateField('allowNightOffDay', v)}
            />
          </div>
        </div>

        {/* 우측 패널: 인원 설정 */}
        <div className="card">
          <div className="card-title">평일 근무 인원</div>
          <div className="form-row">
            <div className="form-group">
              <label>낮번(D) 인원</label>
              <input type="number" min={0} max={20} value={rule.weekdayDayCount}
                onChange={e => updateField('weekdayDayCount', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>저녁번(E) 인원</label>
              <input type="number" min={0} max={20} value={rule.weekdayEveningCount}
                onChange={e => updateField('weekdayEveningCount', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>밤번(N) 인원</label>
              <input type="number" min={0} max={20} value={rule.weekdayNightCount}
                onChange={e => updateField('weekdayNightCount', Number(e.target.value))} />
            </div>
          </div>

          <div className="card-title" style={{ marginTop: '1.5rem' }}>주말/공휴일 근무 인원</div>
          <div className="form-row">
            <div className="form-group">
              <label>낮번(D) 인원</label>
              <input type="number" min={0} max={20} value={rule.weekendDayCount}
                onChange={e => updateField('weekendDayCount', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>저녁번(E) 인원</label>
              <input type="number" min={0} max={20} value={rule.weekendEveningCount}
                onChange={e => updateField('weekendEveningCount', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>밤번(N) 인원</label>
              <input type="number" min={0} max={20} value={rule.weekendNightCount}
                onChange={e => updateField('weekendNightCount', Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle" onClick={() => onChange(!checked)}>
      <div className={`toggle-track ${checked ? 'on' : ''}`}>
        <div className="toggle-thumb" />
      </div>
      {label}
    </label>
  );
}
