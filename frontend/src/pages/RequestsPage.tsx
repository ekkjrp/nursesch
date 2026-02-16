import { useEffect, useState } from 'react';
import { shiftRequests as reqApi, leaves as leavesApi, nurses as nursesApi } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

const SHIFT_LABELS: Record<string, string> = {
  D: '데이', E: '이브닝', N: '나이트', M: '미드', O: '오프', Y: '연차', X: '기타',
};

export default function RequestsPage() {
  const { nurse: me, isAdmin } = useAuth();
  const [yearMonth, setYearMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [requests, setRequests] = useState<any[]>([]);
  const [leaveList, setLeaveList] = useState<any[]>([]);
  const [nurseList, setNurseList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'requests' | 'leaves'>('requests');

  // 요청 폼
  const [reqForm, setReqForm] = useState({ date: '', requested_shift_type: 'O', reason: '' });
  // 관리자 지정 폼
  const [adminForm, setAdminForm] = useState({ nurse_id: 0, date: '', requested_shift_type: 'O' });
  // 연차 편집
  const [editingLeave, setEditingLeave] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [reqs, nurses] = await Promise.all([
        reqApi.list(yearMonth),
        nursesApi.list(me?.ward_id),
      ]);
      setRequests(reqs);
      setNurseList(nurses);

      if (isAdmin && me?.ward_id) {
        const lvs = await leavesApi.getWard(me.ward_id, yearMonth);
        setLeaveList(lvs);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (me) load(); }, [yearMonth, me]);

  const handleApprove = async (id: number) => {
    try { await reqApi.approve(id); load(); } catch (e: any) { setError(e.message); }
  };
  const handleReject = async (id: number) => {
    try { await reqApi.reject(id); load(); } catch (e: any) { setError(e.message); }
  };
  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try { await reqApi.delete(id); load(); } catch (e: any) { setError(e.message); }
  };

  const handleSubmitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await reqApi.create({ ...reqForm, year_month: yearMonth });
      setReqForm({ date: '', requested_shift_type: 'O', reason: '' });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleAdminReq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await reqApi.adminCreate({ ...adminForm, year_month: yearMonth });
      setAdminForm({ nurse_id: 0, date: '', requested_shift_type: 'O' });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleSaveLeave = async (leave: any) => {
    try {
      await leavesApi.upsert(leave.nurse_id, yearMonth, {
        annual_leave_count: leave.annual_leave_count,
        requested_off_dates: leave.requested_off_dates,
      }, me?.ward_id);
      setEditingLeave(null);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { PENDING: '#E67E22', APPROVED: '#27AE60', REJECTED: '#E74C3C' };
    const labels: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' };
    return <span style={{ color: colors[status] || '#666', fontWeight: 600 }}>{labels[status] || status}</span>;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>근무 요청 및 연차 관리</h2>
        <input type="month" className="form-control" style={{ width: 140 }}
          value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tab-bar">
        <button className={'tab-btn' + (activeTab === 'requests' ? ' active' : '')}
          onClick={() => setActiveTab('requests')}>근무 요청</button>
        {isAdmin && (
          <button className={'tab-btn' + (activeTab === 'leaves' ? ' active' : '')}
            onClick={() => setActiveTab('leaves')}>연차 / 희망 휴일</button>
        )}
      </div>

      {activeTab === 'requests' && (
        <>
          {/* 간호사 본인 요청 폼 */}
          {!isAdmin && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 className="card-title">근무 요청 제출 (월 최대 2건)</h3>
              <form onSubmit={handleSubmitReq} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>날짜</label>
                  <input type="date" className="form-control" value={reqForm.date}
                    onChange={(e) => setReqForm({ ...reqForm, date: e.target.value })} required
                    min={'${yearMonth}-01'} max={'${yearMonth}-31'} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>근무 유형</label>
                  <select className="form-control" value={reqForm.requested_shift_type}
                    onChange={(e) => setReqForm({ ...reqForm, requested_shift_type: e.target.value })}>
                    {Object.entries(SHIFT_LABELS).map(([k, v]) => <option key={k} value={k}>{k} ({v})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                  <label>사유 (선택)</label>
                  <input className="form-control" value={reqForm.reason}
                    onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary">요청 제출</button>
              </form>
            </div>
          )}

          {/* 관리자 직접 지정 폼 */}
          {isAdmin && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 className="card-title">관리자 직접 근무/휴일 지정</h3>
              <form onSubmit={handleAdminReq} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>간호사</label>
                  <select className="form-control" value={adminForm.nurse_id}
                    onChange={(e) => setAdminForm({ ...adminForm, nurse_id: +e.target.value })} required>
                    <option value={0}>선택</option>
                    {nurseList.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.grade})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>날짜</label>
                  <input type="date" className="form-control" value={adminForm.date}
                    onChange={(e) => setAdminForm({ ...adminForm, date: e.target.value })} required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>근무 유형</label>
                  <select className="form-control" value={adminForm.requested_shift_type}
                    onChange={(e) => setAdminForm({ ...adminForm, requested_shift_type: e.target.value })}>
                    {Object.entries(SHIFT_LABELS).map(([k, v]) => <option key={k} value={k}>{k} ({v})</option>)}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">지정</button>
              </form>
            </div>
          )}

          <div className="card">
            <h3 className="card-title">{yearMonth} 근무 요청 목록</h3>
            {loading ? <p>로딩 중...</p> : (
              <table className="table">
                <thead>
                  <tr>
                    <th>간호사</th><th>날짜</th><th>근무</th><th>구분</th><th>상태</th><th>사유</th>
                    {isAdmin && <th>관리</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: '#aaa' }}>요청 없음</td></tr>
                  ) : requests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.nurse_name || r.nurse_id}</td>
                      <td>{r.date}</td>
                      <td><span className={'shift-badge shift-' + r.requested_shift_type.toLowerCase()}>{r.requested_shift_type} ({SHIFT_LABELS[r.requested_shift_type]})</span></td>
                      <td>{r.is_admin_set ? <span style={{ color: '#7F8C8D' }}>관리자 지정</span> : '간호사 요청'}</td>
                      <td>{statusBadge(r.status)}</td>
                      <td>{r.reason || '—'}</td>
                      {isAdmin && (
                        <td>
                          {r.status === 'PENDING' && (
                            <>
                              <button className="btn btn-sm btn-success" onClick={() => handleApprove(r.id)} style={{ marginRight: 4 }}>승인</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleReject(r.id)} style={{ marginRight: 4 }}>반려</button>
                            </>
                          )}
                          <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(r.id)}>삭제</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'leaves' && isAdmin && (
        <div className="card">
          <h3 className="card-title">{yearMonth} 간호사별 연차 / 총 비근무일수</h3>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            총 비근무일수 = 주말 + 공휴일 + 연차. 이 일수가 근무표 생성 시 반영됩니다.
          </p>
          <table className="table">
            <thead>
              <tr><th>간호사</th><th>직급</th><th>월 연차수</th><th>희망 휴일</th><th>총 비근무일수</th><th>관리</th></tr>
            </thead>
            <tbody>
              {leaveList.map((lv) => {
                const n = nurseList.find((x) => x.id === lv.nurse_id);
                const isEditing = editingLeave?.nurse_id === lv.nurse_id;
                return (
                  <tr key={lv.nurse_id}>
                    <td>{n?.name || lv.nurse_id}</td>
                    <td>{n?.grade}</td>
                    <td>
                      {isEditing ? (
                        <input type="number" className="form-control input-sm" min={0}
                          value={editingLeave.annual_leave_count}
                          onChange={(e) => setEditingLeave({ ...editingLeave, annual_leave_count: +e.target.value })} />
                      ) : '${lv.annual_leave_count}일'}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="form-control input-sm" placeholder="YYYY-MM-DD 콤마구분"
                          value={(editingLeave.requested_off_dates || []).join(',')}
                          onChange={(e) => setEditingLeave({
                            ...editingLeave,
                            requested_off_dates: e.target.value ? e.target.value.split(',').map((s: string) => s.trim()) : [],
                          })} />
                      ) : (lv.requested_off_dates?.length > 0 ? lv.requested_off_dates.join(', ') : '—')}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{lv.total_off_days}일</td>
                    <td>
                      {isEditing ? (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => handleSaveLeave(editingLeave)} style={{ marginRight: 4 }}>저장</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingLeave(null)}>취소</button>
                        </>
                      ) : (
                        <button className="btn btn-sm btn-secondary" onClick={() => setEditingLeave({ ...lv })}>수정</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
