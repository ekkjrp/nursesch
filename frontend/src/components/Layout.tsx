import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">NurseSch</div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
            대시보드
          </NavLink>
          {isAdmin && (
            <NavLink to="/nurses" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              간호사 관리
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/rules" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              근무 규칙
            </NavLink>
          )}
          <NavLink to="/schedule" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            근무표
          </NavLink>
          <NavLink to="/requests" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            근무 요청
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{user?.name}</div>
          <div>{user?.role === 'ADMIN' ? '관리자' : '간호사'}</div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem' }} onClick={logout}>
            로그아웃
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
