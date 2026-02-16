import React, { useEffect, useState, useRef } from 'react';
import { nurses as nursesApi } from '../api.ts';
import { useAuth } from '../context/AuthContext.tsx';

const GRADES = [
  { value: 'HN', label: 'HN (수간호사)' },
  { value: 'CN', label: 'CN (책임간호사)' },
  { value: 'RN', label: 'RN (평간호사)' },
  { value: 'AN', label: 'AN (보조간호사)' },
];

const GRADE_LABEL: Record<string, string> = {
  HN: '수간호사', CN: '책임간호사', RN: '평간호사', AN: '보조간호사',
};

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
    is_night_dedicated: false, monthly_annual_leave: 1, sort_order: 0,
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
    setForm({ name: '', email: '', password: '', grade: 'RN', is_night_dedicated: false, monthly_annual_leave: 1, sort_order: 0 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (nurse: any) => {
    setEditing(nurse);
    setForm({
      name: nurse.name, email: nurse.email, password: '',
      grade: nurse.grade, is_night_dedicated: nurse.is_night_dedicated,
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
          is_night_dedicated: form.is_night_dedicated,
          monthly_annual_leave: form.monthly_annual_leave, sort_order: form.sort_order,
        };
        if (form.password) payload.password = form.password;
        await nursesApi.update(editing.id, payload);
      } else {
        await nursesApi.create({ ...form, ward_id: currentNurse?.ward_id });
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
      const ord: Record<string, number> = { HN: 0, CN: 1, RN: 2, AN: 3 };
      return (ord[a.grade] ?? 9) - (ord[b.grade] ?? 9);
    }
    return 0;
  });

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => setSortKey(col)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: sortKey === col ? 700 : 400 }}>
      {label}{sortKey === col ? ' ▲' : ''}
    </button>
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2>간호사 관리</h2>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ 간호사 추가</button>}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>행을 드래그하여 순서를 지정하세요. 지정 순서는 모든 정렬보다 우선합니다.</p>
      <table className="table">
        <thead>
          <tr>
            <th>순서</th>
            <th><SortBtn col="name" label="이름" /></th>
            <th><SortBtn col="email" label="이메일" /></th>
            <th><SortBtn col="grade" label="직급" /></th>
            <th>나이트 전담</th>
            <th>월 연차</th>
            {isAdmin && <th>관리</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} style={{ textAlign: 'center' }}>로딩 중...</td></tr>
          ) : sortedList.map((nurse, idx) => (
            <tr key={nurse.id} draggable={isAdmin}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              style={{ cursor: isAdmin ? 'grab' : 'default' }}>
              <td style={{ textAlign: 'center', color: '#aaa' }}>{nurse.sort_order || '—'}</td>
              <td>{nurse.name}</td>
              <td>{nurse.email}</td>
              <td><span className={`badge badge-grade-${nurse.grade.toLowerCase()}`}>{nurse.grade} ({GRADE_LABEL[nurse.grade]})</span></td>
              <td style={{ textAlign: 'center' }}>{nurse.is_night_dedicated ? <span style={{ color: '#9B59B6' }}>● 전담</span> : '—'}</td>
              <td style={{ textAlign: 'center' }}>{nurse.monthly_annual_leave}일</td>
              {isAdmin && (
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(nurse)} style={{ marginRight: 4 }}>수정</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(nurse.id)}>삭제</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? '간호사 수정' : '간호사 추가'}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label>이름</label>
                <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>이메일</label>
                <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{editing ? '비밀번호 (변경 시만 입력)' : '비밀번호'}</label>
                <input type="password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
              </div>
              <div className="form-group">
                <label>직급</label>
                <select className="form-control" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                  {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>정렬 순서 (0=자동)</label>
                <input type="number" className="form-control" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>월 연차 수 (일)</label>
                <input type="number" className="form-control" min={0} value={form.monthly_annual_leave} onChange={(e) => setForm({ ...form, monthly_annual_leave: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_night_dedicated} onChange={(e) => setForm({ ...form, is_night_dedicated: e.target.checked })} />
                  나이트 전담 지정
                </label>
                {form.is_night_dedicated && (
                  <p style={{ fontSize: 12, color: '#9B59B6', margin: '4px 0 0' }}>나이트 전담이 지정되면 일반 간호사는 나이트에 자동 배정되지 않습니다.</p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>취소</button>
                <button type="submit" className="btn btn-primary">{editing ? '수정 완료' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
