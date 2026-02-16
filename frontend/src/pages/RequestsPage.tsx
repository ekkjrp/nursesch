import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { shiftRequests as reqApi, schedules as schedulesApi } from '../api.ts';

// 근무 요청 관리 (designreq.md FR-7)
const SHIFT_LABELS: Record<string, string> = { D: '낮번', E: '저녁번', N: '밤번', O: '휴무', X: '기타' };
const STATUS_LABELS: Record<string, string> = { PENDING: '대기중', APPROVED: '승인', REJECTED: '반려' };

export function RequestsPage() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [scheduleList, setScheduleList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ scheduleId: '', date: '', requestedShiftType: 'O', reason: '' });

  const load = () => {
    if (!user) return;
    schedulesApi.list(user.wardId).then(setScheduleList).catch(() => {});
    // 관리자: 전체, 간호사: 본인 것만
    reqApi.list().then(data => {
      if (!isAdmin) {
        setRequests(data.filter((r: any) => r.nurseId === user.id));
      } else {
        setRequests(data);
      }
    }).catch(() => {});
  };

  useEffect(load, [user]);

  const handleSubmit = async () => {
    try {
      await reqApi.create({
        scheduleId: Number(form.scheduleId),
        date: form.date,
        requestedShiftType: form.requestedShiftType,
        reason: form.reason || undefined,
      });
      setShowForm(false);
      setForm({ scheduleId: '', date: '', requestedShiftType: 'O', reason: '' });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>근무 요청</h1>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 요청 제출</button>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">근무 요청 제출</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>월 최대 2건까지 요청 가능합니다</p>
            <div className="form-group">
              <label>대상 근무표</label>
              <select value={form.scheduleId} onChange={e => setForm({ ...form, scheduleId: e.target.value })}>
                <option value="">선택</option>
                {scheduleList.map(s => (
                  <option key={s.id} value={s.id}>{s.yearMonth}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>날짜</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label>요청 근무 유형</label>
              <select value={form.requestedShiftType} onChange={e => setForm({ ...form, requestedShiftType: e.target.value })}>
                {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v} ({k})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>사유 (선택)</label>
              <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="사유" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSubmit}>제출</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {requests.length === 0 ? (
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>요청이 없습니다.</p>
        ) : (
          <table>
            <thead>
              <tr>
                {isAdmin && <th>간호사</th>}
                <th>날짜</th>
                <th>요청 근무</th>
                <th>사유</th>
                <th>상태</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  {isAdmin && <td>{r.nurse?.name || '-'}</td>}
                  <td>{r.date}</td>
                  <td>
                    <span className={`shift-cell ${r.requestedShiftType}`} style={{ display: 'inline-flex', width: 28, height: 24, fontSize: '0.7rem' }}>
                      {r.requestedShiftType}
                    </span>
                    {' '}{SHIFT_LABELS[r.requestedShiftType]}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{r.reason || '-'}</td>
                  <td>
                    <span className={`badge badge-${r.status.toLowerCase()}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  {isAdmin && r.status === 'PENDING' && (
                    <td style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-success btn-sm" onClick={async () => { await reqApi.approve(r.id); load(); }}>승인</button>
                      <button className="btn btn-danger btn-sm" onClick={async () => { await reqApi.reject(r.id); load(); }}>반려</button>
                    </td>
                  )}
                  {isAdmin && r.status !== 'PENDING' && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
