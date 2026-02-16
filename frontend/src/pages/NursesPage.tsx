import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { nurses as nursesApi } from '../api.ts';

const SKILL_LABELS: Record<string, string> = {
  JUNIOR: '주니어',
  SENIOR: '시니어',
  CHARGE: '책임',
};

export function NursesPage() {
  const { user } = useAuth();
  const [nurseList, setNurseList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', email: '', skillLevel: 'SENIOR', password: 'changeme123' });

  const loadNurses = () => {
    if (user) nursesApi.list(user.wardId).then(setNurseList).catch(() => {});
  };

  useEffect(loadNurses, [user]);

  const handleSubmit = async () => {
    try {
      if (editId) {
        await nursesApi.update(editId, { name: form.name, email: form.email, skillLevel: form.skillLevel, wardId: user!.wardId });
      } else {
        await nursesApi.create({ ...form, wardId: user!.wardId, role: 'NURSE' });
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', email: '', skillLevel: 'SENIOR', password: 'changeme123' });
      loadNurses();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await nursesApi.delete(id);
    loadNurses();
  };

  const startEdit = (nurse: any) => {
    setEditId(nurse.id);
    setForm({ name: nurse.name, email: nurse.email, skillLevel: nurse.skillLevel, password: '' });
    setShowForm(true);
  };

  return (
    <div>
      <div className="page-header">
        <h1>간호사 관리</h1>
        <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ name: '', email: '', skillLevel: 'SENIOR', password: 'changeme123' }); setShowForm(true); }}>
          + 간호사 추가
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editId ? '간호사 수정' : '간호사 추가'}</div>
            <div className="form-group">
              <label>이름</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="이름" />
            </div>
            <div className="form-group">
              <label>이메일</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="이메일" />
            </div>
            <div className="form-group">
              <label>숙련도</label>
              <select value={form.skillLevel} onChange={e => setForm({ ...form, skillLevel: e.target.value })}>
                <option value="JUNIOR">주니어</option>
                <option value="SENIOR">시니어</option>
                <option value="CHARGE">책임</option>
              </select>
            </div>
            {!editId && (
              <div className="form-group">
                <label>초기 비밀번호</label>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{editId ? '수정' : '추가'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th>숙련도</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {nurseList.map(n => (
              <tr key={n.id}>
                <td style={{ fontWeight: 600 }}>{n.name}</td>
                <td>{n.email}</td>
                <td>{n.role === 'ADMIN' ? '관리자' : '간호사'}</td>
                <td>{SKILL_LABELS[n.skillLevel] || n.skillLevel}</td>
                <td style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(n)}>수정</button>
                  {n.role !== 'ADMIN' && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(n.id)}>삭제</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
