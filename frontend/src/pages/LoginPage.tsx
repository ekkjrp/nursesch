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
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-title">NurseSch</div>
        <div className="login-subtitle">간호사 근무표 자동 생성 서비스</div>
        {error && <div className="login-error">{error}</div>}
        <input
          type="email" placeholder="이메일" value={email}
          onChange={e => setEmail(e.target.value)} required autoFocus
        />
        <input
          type="password" placeholder="비밀번호" value={password}
          onChange={e => setPassword(e.target.value)} required
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
