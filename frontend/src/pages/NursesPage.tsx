import React, { useEffect, useState, useRef } from 'react';
import { nurses as nursesApi } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

const GRADES = [
  { value: 'HN', label: 'HN (수간호사)' },
  { value: 'CN', label: 'CN (책임간호사)' },
  { value: 'RN', label: 'RN (평간호사)' },
  { value: 'AN', label: 'AN (보조간호사)' },
  { value: 'PN', label: 'PN (임시간호사)' },
];

const GRADE_LABEL: Record<string, string> = {
  HN: '수간호사', CN: '책임간호사', RN: '평간호사', AN: '보조간호사', PN: '임시간호사',
};

const DEDICATED_SHIFTS = [
  { value: '', label: '없음' },
  { value: 'D', label: 'D (데이)' },
  { value: 'E', label: 'E (이브닝)' },
  { value: 'N', label: 'N (나이트)' },
  { value: 'M', label: 'M (미드)' },
];

const PREFERENCE_SHIFTS = [
  { value: '', label: '없음' },
  { value: 'D', label: 'D (데이)' },
  { value: 'E', label: 'E (이브닝)' },
  { value: 'N', label: 'N (나이트)' },
];

const DEDICATED_COLORS: Record<string, string> = { D: '#3b82f6', E: '#10b981', N: '#8b5cf6', M: '#0ea5e9' };
const DEDICATED_LABELS: Record<string, string> = { D: '데이', E: '이브닝', N: '나이트', M: '미드' };

type SortKey = 'sort_order' | 'name' | 'email' | 'grade';

export default function NursesPage() {
  const { nurse: currentNurse, isAdmin } = useAuth();
  const [nurseList, setNurseList] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('sort_order');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', password: '', grade: 'RN',
    dedicated_shift: '', weekday_preference: '', weekend_preference: '',
    monthly_annual_leave: 1, sort_order: 0,
  });
  const dragIdx = useRef<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await nursesApi.list(currentNurse?.ward_id, sortKey);
      setNurseList(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [sortKey]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', password: '', grade: 'RN', dedicated_shift: '', weekday_preference: '', weekend_preference: '', monthly_annual_leave: 1, sort_order: 0 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (nurse: any) => {
    setEditing(nurse);
    setForm({
      name: nurse.name, email: nurse.email, password: '',
      grade: nurse.grade, dedicated_shift: nurse.dedicated_shift || '',
      weekday_preference: nurse.weekday_preference || '',
      weekend_preference: nurse.weekend_preference || '',
      monthly_annual_leave: nurse.monthly_annual_leave, sort_order: nurse.sort_order,
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        const payload: any = {
          name: form.name, email: form.email, grade: form.grade,
          dedicated_shift: form.dedicated_shift || null,
          weekday_preference: form.weekday_preference || null,
          weekend_preference: form.weekend_preference || null,
          monthly_annual_leave: form.monthly_annual_leave, sort_order: form.sort_order,
        };
        if (form.password) payload.password = form.password;
        await nursesApi.update(editing.id, payload);
      } else {
        await nursesApi.create({
          ...form,
          dedicated_shift: form.dedicated_shift || null,
          weekday_preference: form.weekday_preference || null,
          weekend_preference: form.weekend_preference || null,
          ward_id: currentNurse?.ward_id,
        });
      }
      closeModal();
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('간호사를 삭제하시겠습니까?')) return;
    try { await nursesApi.delete(id); load(); } catch (e: any) { setError(e.message); }
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (targetIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === targetIdx) return;
    const reordered = [...nurseList];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(targetIdx, 0, moved);
    const items = reordered.map((n, i) => ({ id: n.id, sort_order: i + 1 }));
    setNurseList(reordered);
    dragIdx.current = null;
    try { await nursesApi.reorder(items); } catch (e: any) { setError(e.message); load(); }
  };

  const sortedList = [...nurseList].sort((a, b) => {
    const ao = a.sort_order > 0 ? a.sort_order : 99999;
    const bo = b.sort_order > 0 ? b.sort_order : 99999;
    if (ao !== bo) return ao - bo;
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'email') return a.email.localeCompare(b.email);
    if (sortKey === 'grade') {
      const ord: Record<string, number> = { HN: 0, CN: 1, RN: 2, AN: 3, PN: 4 };
      return (ord[a.grade] ?? 9) - (ord[b.grade] ?? 9);
    }
    return 0;
  });

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => setSortKey(col)} className="btn-sort" style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: sortKey === col ? 'var(--primary-light)' : 'var(--text-secondary)',
      fontWeight: sortKey === col ? 700 : 500, fontSize: '0.8rem',
      display: 'flex', alignItems: 'center', gap: 4
    }}>
      {label}
      {sortKey === col && <span style={{ fontSize: '0.7rem' }}>▼</span>}
    </button>
  );

  const dedicatedLabel = (shift: string | null) => {
    if (!shift) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
      <span className={`shift-badge shift-${shift} animate-pulse`}
        style={{ fontSize: '0.75rem', width: 'auto', padding: '0 8px', height: 22 }}>
        {shift} 전담
      </span>
    );
  };

  return (
    <div className="page animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 8 }}>👩‍⚕️ 간호사 관리</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            총 {nurseList.length}명의 간호사가 등록되어 있습니다.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreate}>
            <span style={{ fontSize: '1.2rem', marginRight: 4 }}>+</span> 간호사 추가
          </button>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.1)', color: 'var(--danger)', border: '1px solid rgba(244, 63, 94, 0.2)',
          padding: 16, borderRadius: 12, marginBottom: 24
        }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 60, paddingLeft: 24 }}>순서</th>
              <th><SortBtn col="name" label="이름" /></th>
              <th><SortBtn col="email" label="이메일" /></th>
              <th><SortBtn col="grade" label="직급" /></th>
              <th>지정근무</th>
              <th>평일선호</th>
              <th>주말선호</th>
              <th>월 연차</th>
              {isAdmin && <th style={{ textAlign: 'right', paddingRight: 24 }}>관리</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
                <div style={{ color: 'var(--text-muted)' }}>데이터를 불러오는 중...</div>
              </td></tr>
            ) : sortedList.map((nurse, idx) => (
              <tr key={nurse.id} draggable={isAdmin}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                style={{
                  cursor: isAdmin ? 'grab' : 'default',
                  transition: 'background 0.2s',
                  background: dragIdx.current === idx ? 'rgba(99, 102, 241, 0.1)' : 'transparent'
                }}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', paddingLeft: 24 }}>
                  {nurse.sort_order || '—'}
                </td>
                <td style={{ fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-accent)'
                    }}>
                      {nurse.name[0]}
                    </div>
                    {nurse.name}
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{nurse.email}</td>
                <td>
                  <span className="badge" style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}>
                    {nurse.grade}
                  </span>
                </td>
                <td>{dedicatedLabel(nurse.dedicated_shift)}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{nurse.weekday_preference || '—'}</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{nurse.weekend_preference || '—'}</td>
                <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{nurse.monthly_annual_leave}일</td>
                {isAdmin && (
                  <td style={{ textAlign: 'right', paddingRight: 24 }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(nurse)}>수정</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(nurse.id)}>삭제</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }} onClick={closeModal}>
          <div className="card" style={{ width: '100%', maxWidth: 600, margin: 24, padding: 32, animation: 'scaleIn 0.3s ease-out' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.4rem' }}>{editing ? '📝 간호사 정보 수정' : '✨ 새 간호사 등록'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>이름</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="홍길동" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>이메일</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="nurse@hospital.com" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{editing ? '비밀번호 (변경 시)' : '비밀번호'}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} placeholder="••••••••" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>직급</label>
                  <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                    {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12, marginBottom: 24 }}>
                <h4 style={{ fontSize: '1rem', marginBottom: 16, color: 'var(--text-accent)' }}>근무 설정</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem' }}>지정 근무</label>
                    <select value={form.dedicated_shift} onChange={(e) => setForm({ ...form, dedicated_shift: e.target.value })}>
                      {DEDICATED_SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem' }}>평일 선호</label>
                    <select value={form.weekday_preference} onChange={(e) => setForm({ ...form, weekday_preference: e.target.value })}>
                      {PREFERENCE_SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem' }}>주말 선호</label>
                    <select value={form.weekend_preference} onChange={(e) => setForm({ ...form, weekend_preference: e.target.value })}>
                      {PREFERENCE_SHIFTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem' }}>정렬 순서</label>
                    <input type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem' }}>월 연차 수</label>
                    <input type="number" min={0} value={form.monthly_annual_leave} onChange={(e) => setForm({ ...form, monthly_annual_leave: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>취소</button>
                <button type="submit" className="btn btn-primary">{editing ? '수정 완료' : '등록하기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
