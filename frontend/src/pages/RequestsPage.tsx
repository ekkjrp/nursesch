import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { shiftRequests as reqApi, nurses as nursesApi, leaves as leavesApi } from '../api.ts';

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
const SHIFT_TYPES_REQ = ['D', 'E', 'N', 'M', 'O'];
const SHIFT_LABELS: Record<string, string> = { D: '데이', E: '이브닝', N: '나이트', M: '미드', O: '오프' };

export default function RequestsPage() {
  const { nurse: currentNurse, isAdmin } = useAuth();
  const [tab, setTab] = useState<'requests' | 'leaves'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [nurseList, setNurseList] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('O');
  const [submitting, setSubmitting] = useState(false);

  // Admin direct assign
  const [directNurseId, setDirectNurseId] = useState<number>(0);
  const [directShift, setDirectShift] = useState('D');

  // Modal for requested_off_dates
  const [pickerNurse, setPickerNurse] = useState<any | null>(null);
  const [pickedDates, setPickedDates] = useState<string[]>([]);
  const [pickerYear, setPickerYear] = useState(calYear);
  const [pickerMonth, setPickerMonth] = useState(calMonth);

  const calYM = `${calYear}-${String(calMonth).padStart(2, '0')}`;
  const pickerYM = `${pickerYear}-${String(pickerMonth).padStart(2, '0')}`;

  const load = async () => {
    setLoading(true);
    try {
      const [reqs, nurses] = await Promise.all([
        reqApi.list(calYM),
        nursesApi.list(currentNurse?.ward_id),
      ]);
      setRequests(reqs);
      setNurseList(nurses.sort((a,b) => (a.sort_order||999) - (b.sort_order||999) || a.name.localeCompare(b.name)));
      if (isAdmin && currentNurse?.ward_id) {
        try { setLeaveData(await leavesApi.getWard(currentNurse.ward_id, calYM)); } catch { setLeaveData([]); }
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [calYM]);

  const handleSubmitRequest = async () => {
    if (!selectedDate || !currentNurse) return;
    setSubmitting(true);
    setError('');
    try {
      await reqApi.create({
        nurse_id: currentNurse.id,
        year_month: calYM,
        date: selectedDate,
        requested_shift_type: selectedShift,
      });
      setSelectedDate('');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async (id: number) => {
    try { await reqApi.approve(id); await load(); } catch (e: any) { setError(e.message); }
  };
  const handleReject = async (id: number) => {
    try { await reqApi.reject(id); await load(); } catch (e: any) { setError(e.message); }
  };
  const handleDelete = async (id: number) => {
    try { await reqApi.delete(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const handleDirectAssign = async () => {
    if (!selectedDate || !directNurseId) return;
    setSubmitting(true);
    setError('');
    try {
      await reqApi.adminCreate({
        nurse_id: directNurseId,
        year_month: calYM,
        date: selectedDate,
        requested_shift_type: directShift,
        status: 'APPROVED',
      });
      setSelectedDate('');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleLeaveUpdate = async (nurseId: number, data: any) => {
    try {
      await leavesApi.upsert(nurseId, calYM, {
        annual_leave_count: data.annual_leave_count || 0,
        requested_off_dates: data.requested_off_dates || [],
        total_off_days_override: data.total_off_days_override === '' ? null : (isNaN(data.total_off_days_override) ? null : Number(data.total_off_days_override)),
      });
      await load(); // Reload to get calculated total_off_days
    } catch (e: any) { setError(e.message); }
  };

  // Calendar helpers
  const getCalendarCells = (y: number, m: number) => {
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    return cells;
  };
  const calendarCells = getCalendarCells(calYear, calMonth);
  const pickerCells = getCalendarCells(pickerYear, pickerMonth);

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12); }
    else setCalMonth(calMonth - 1);
    setSelectedDate('');
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1); }
    else setCalMonth(calMonth + 1);
    setSelectedDate('');
  };

  const prevPickerMonth = () => {
    if (pickerMonth === 1) { setPickerYear(pickerYear - 1); setPickerMonth(12); }
    else setPickerMonth(pickerMonth - 1);
  };
  const nextPickerMonth = () => {
    if (pickerMonth === 12) { setPickerYear(pickerYear + 1); setPickerMonth(1); }
    else setPickerMonth(pickerMonth + 1);
  };

  const openPicker = (nurse: any, initialDates: string[]) => {
    setPickerNurse(nurse);
    setPickedDates(initialDates || []);
    setPickerYear(calYear);
    setPickerMonth(calMonth);
  };
  const togglePickedDate = (d: string) => {
    setPickedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };
  const savePickedDates = () => {
    if (pickerNurse) {
      const existing = leaveData.find(l => l.nurse_id === pickerNurse.id) || { annual_leave_count: pickerNurse.monthly_annual_leave, total_off_days_override: null };
      handleLeaveUpdate(pickerNurse.id, { ...existing, requested_off_dates: pickedDates });
    }
    setPickerNurse(null);
  };


  const nurseMap = new Map(nurseList.map((n) => [n.id, n]));
  const myRequests = requests.filter((r) => r.nurse_id === currentNurse?.id);

  // Group requests by nurse
  const requestsByNurse: Record<number, any[]> = {};
  requests.forEach(r => {
    if (!requestsByNurse[r.nurse_id]) requestsByNurse[r.nurse_id] = [];
    requestsByNurse[r.nurse_id].push(r);
  });
  Object.values(requestsByNurse).forEach(arr => arr.sort((a,b) => a.date.localeCompare(b.date)));

  return (
    <div className="page animate-fade-in">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.5rem' }}>📝 근무 요청 및 연차 관리</h2>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <button
          className={`btn ${tab === 'requests' ? 'btn-primary' : 'btn-text'}`}
          onClick={() => setTab('requests')}
          style={{ borderRadius: '12px 12px 0 0', borderBottom: tab === 'requests' ? 'none' : '1px solid transparent' }}
        >
          📝 일반 근무 요청
        </button>
        <button
          className={`btn ${tab === 'leaves' ? 'btn-primary' : 'btn-text'}`}
          onClick={() => setTab('leaves')}
          style={{ borderRadius: '12px 12px 0 0', borderBottom: tab === 'leaves' ? 'none' : '1px solid transparent' }}
        >
          🏖️ 연차 및 희망 휴일 설정
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(244,63,94,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,63,94,0.2)',
          padding: 16, borderRadius: 12, marginBottom: 24
        }}>
          {error}
        </div>
      )}

      {tab === 'requests' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: 32, alignItems: 'start' }}>
          {/* Calendar Select */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <button className="btn btn-sm btn-outline" onClick={prevMonth}>◀</button>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{calYear}년 {calMonth}월</div>
              <button className="btn btn-sm btn-outline" onClick={nextMonth}>▶</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
              {DAYS_KR.map((d, i) => (
                <div key={d} style={{ fontSize: '0.85rem', fontWeight: 600, color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--primary-light)' : 'var(--text-secondary)' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {calendarCells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const date = `${calYM}-${String(day).padStart(2, '0')}`;
                const dow = new Date(calYear, calMonth - 1, day).getDay();
                const isSel = selectedDate === date;
                const hasReq = requests.some((r) => r.date === date && r.nurse_id === currentNurse?.id);

                return (
                  <div key={day}
                    onClick={() => setSelectedDate(date)}
                    style={{
                      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 12, cursor: 'pointer', position: 'relative',
                      background: isSel ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                      color: isSel ? 'white' : dow === 0 ? 'var(--danger)' : dow === 6 ? 'var(--primary-light)' : 'var(--text-primary)',
                      border: isSel ? '2px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                      boxShadow: isSel ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {day}
                    {hasReq && !isSel && (
                      <div style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: '50%', background: 'var(--primary-light)' }} />
                    )}
                  </div>
                );
              })}
            </div>

            {selectedDate && (
              <div className="animate-fade-in" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: 16 }}>📅 {selectedDate} 요청</h4>
                {!isAdmin ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <select className="form-control" value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
                      {SHIFT_TYPES_REQ.map((s) => <option key={s} value={s}>{s} ({SHIFT_LABELS[s]})</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={handleSubmitRequest} disabled={submitting}>
                      {submitting ? '처리 중...' : '요청 제출'}
                    </button>
                    <p style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>월 최대 2건까지만 요청할 수 있습니다.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="badge" style={{ background: 'var(--warning)', color: 'black', alignSelf: 'flex-start' }}>관리자 직접 지정</div>
                    <select className="form-control" value={directNurseId} onChange={(e) => setDirectNurseId(+e.target.value)}>
                      <option value={0}>간호사 선택...</option>
                      {nurseList.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.grade})</option>)}
                    </select>
                    <select className="form-control" value={directShift} onChange={(e) => setDirectShift(e.target.value)}>
                      {SHIFT_TYPES_REQ.map((s) => <option key={s} value={s}>{s} ({SHIFT_LABELS[s]})</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={handleDirectAssign} disabled={submitting || !directNurseId}>
                      {submitting ? '처리 중...' : '직접 지정 (승인 처리)'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* List Area */}
          <div>
            {isAdmin ? (
              <div className="card">
                <h3 className="card-title">근무 요청 목록 ({requests.length}건)</h3>
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                  {Object.keys(requestsByNurse).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>요청 없음</div>
                  ) : (
                    <table className="table">
                      <thead><tr><th>간호사</th><th>요청 내역</th></tr></thead>
                      <tbody>
                        {nurseList.map(nurse => {
                          const reqs = requestsByNurse[nurse.id];
                          if (!reqs || reqs.length === 0) return null;
                          return (
                            <tr key={nurse.id}>
                              <td style={{ verticalAlign: 'top', width: '120px' }}>
                                <div style={{fontWeight:600}}>{nurse.name}</div>
                                <span className={`badge badge-grade-${(nurse.grade || 'rn').toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                                  {nurse.grade}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {reqs.map((r) => (
                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background:'rgba(255,255,255,0.02)', padding:'8px 12px', borderRadius:8 }}>
                                      <div style={{ width: '90px', fontSize:'0.9rem' }}>{r.date}</div>
                                      <span className={`shift-badge shift-${r.requested_shift_type}`} style={{ width: 24, height: 24, flexShrink:0 }}>{r.requested_shift_type}</span>
                                      <span className={`badge badge-${r.status.toLowerCase()}`} style={{ width: 60, textAlign:'center' }}>{r.status}</span>
                                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                                        {r.status === 'PENDING' ? (
                                          <>
                                            <button className="btn btn-sm btn-success" onClick={() => handleApprove(r.id)}>승인</button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleReject(r.id)}>반려</button>
                                          </>
                                        ) : (
                                          <button className="btn btn-sm btn-outline" onClick={() => handleDelete(r.id)}>삭제</button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="card">
                <h3 className="card-title">나의 요청 ({myRequests.length}/2건)</h3>
                {myRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>제출한 요청이 없습니다.</div>
                ) : (
                  <table className="table">
                    <thead><tr><th>날짜</th><th>요청</th><th>상태</th><th>취소</th></tr></thead>
                    <tbody>
                      {myRequests.map((r) => (
                        <tr key={r.id}>
                          <td>{r.date}</td>
                          <td><span className={`shift-badge shift-${r.requested_shift_type}`} style={{ width: 24, height: 24 }}>{r.requested_shift_type}</span></td>
                          <td>
                            <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
                          </td>
                          <td>
                            {r.status === 'PENDING' && (
                              <button className="btn btn-sm btn-outline" onClick={() => handleDelete(r.id)}>취소</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'leaves' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h3 className="card-title">🏖️ 간호사별 연차 및 희망 휴일 관리</h3>
              <div style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>총 비근무일수 = 주말 + 공휴일 + 개인 연차수. 필요 시 총 일수를 강제 지정(override)할 수 있습니다.</div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn btn-sm btn-secondary" onClick={prevMonth}>◀</button>
              <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{calYear}년 {calMonth}월</span>
              <button className="btn btn-sm btn-secondary" onClick={nextMonth}>▶</button>
            </div>
          </div>

          {isAdmin ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>이름/직급</th>
                    <th>해당월 연차 (Y)</th>
                    <th>희망 휴일 목록 (O)</th>
                    <th>총 비근무일수 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {nurseList.map((n) => {
                    const leave = leaveData.find((l: any) => l.nurse_id === n.id) || {
                      annual_leave_count: n.monthly_annual_leave,
                      requested_off_dates: [],
                      total_off_days: 0,
                      total_off_days_override: null
                    };
                    return (
                      <tr key={n.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{n.name}</div>
                          <span className={`badge badge-grade-${n.grade.toLowerCase()}`} style={{fontSize:'0.7rem'}}>{n.grade}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="number" className="form-control" style={{ width: 80, padding: '4px 8px' }} min={0}
                              value={leave.annual_leave_count}
                              onChange={(e) => handleLeaveUpdate(n.id, { ...leave, annual_leave_count: +e.target.value })}
                            />
                            <span>일</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => openPicker(n, leave.requested_off_dates)}>
                              달력으로 선택 📅
                            </button>
                            {leave.requested_off_dates.length === 0 && <span style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>지정 안됨</span>}
                            {leave.requested_off_dates.map((d: string) => (
                              <span key={d} className="badge" style={{background:'rgba(255,255,255,0.1)', color:'var(--text-primary)'}}>
                                {d.substring(5)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{fontSize:'0.9rem', color:'var(--primary-light)', fontWeight:600, width: '90px'}}>
                              목표: {leave.total_off_days}일
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>직접지정:</span>
                              <input type="number" className="form-control" style={{ width: 80, padding: '4px 8px' }} min={0} placeholder="자동"
                                value={leave.total_off_days_override ?? ''}
                                onChange={(e) => handleLeaveUpdate(n.id, { ...leave, total_off_days_override: e.target.value })}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              관리자만 연차/Off 수량을 설정할 수 있습니다.
            </div>
          )}
        </div>
      )}

      {/* Date Picker Modal */}
      {pickerNurse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }} onClick={() => setPickerNurse(null)}>
          <div className="card" style={{ width: 400, animation: 'scaleIn 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>🏖️ {pickerNurse.name} 희망 휴일 선택</h3>
              <button onClick={() => setPickerNurse(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <button className="btn btn-sm btn-outline" onClick={prevPickerMonth}>◀</button>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{pickerYear}년 {pickerMonth}월</div>
              <button className="btn btn-sm btn-outline" onClick={nextPickerMonth}>▶</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
              {DAYS_KR.map((d, i) => (
                <div key={d} style={{ fontSize: '0.85rem', fontWeight: 600, color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--primary-light)' : 'var(--text-secondary)' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 24 }}>
              {pickerCells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const date = `${pickerYM}-${String(day).padStart(2, '0')}`;
                const dow = new Date(pickerYear, pickerMonth - 1, day).getDay();
                const isPicked = pickedDates.includes(date);

                return (
                  <div key={day}
                    onClick={() => togglePickedDate(date)}
                    style={{
                      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 12, cursor: 'pointer',
                      background: isPicked ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                      color: isPicked ? 'white' : dow === 0 ? 'var(--danger)' : dow === 6 ? 'var(--primary-light)' : 'var(--text-primary)',
                      border: isPicked ? '2px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                      transition: 'all 0.1s'
                    }}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setPickerNurse(null)}>취소</button>
              <button className="btn btn-primary" onClick={savePickedDates}>적용하기</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
