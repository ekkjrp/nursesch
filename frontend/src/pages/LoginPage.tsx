import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', background: 'var(--bg-main)'
    }}>
      {/* Animated Background Elements */}
      <div className="animate-float" style={{
        position: 'absolute', top: '-10%', right: '-5%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(60px)', zIndex: 0
      }} />
      <div className="animate-float" style={{
        position: 'absolute', bottom: '-10%', left: '-5%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(244,63,94,0.1) 0%, transparent 70%)',
        borderRadius: '50%', filter: 'blur(60px)', zIndex: 0, animationDelay: '-3s'
      }} />

      <form
        onSubmit={handleSubmit}
        className="glass-panel animate-fade-in"
        style={{
          width: '100%', maxWidth: 420, padding: 48, borderRadius: 24,
          position: 'relative', zIndex: 1, border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: '3rem', marginBottom: 16,
            filter: 'drop-shadow(0 0 20px rgba(99,102,241,0.5))'
          }}>🏥</div>
          <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: 8 }}>NurseSch</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>간호사 근무표 자동 생성 서비스</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244,63,94,0.1)', color: 'var(--danger)',
            padding: '12px', borderRadius: 12, marginBottom: 24, fontSize: '0.9rem',
            textAlign: 'center', border: '1px solid rgba(244,63,94,0.2)'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="name@hospital.com"
              style={{ padding: '14px 16px', fontSize: '1rem' }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{ padding: '14px 16px', fontSize: '1rem' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 12, padding: '16px', fontSize: '1.05rem' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite'
                }} />
                로그인 중...
              </span>
            ) : '로그인'}
          </button>
        </div>
      </form>
    </div>
  );
}
