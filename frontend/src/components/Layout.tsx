import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

const NAV_ITEMS = [
  { path: '/', label: '대시보드', adminOnly: false },
  { path: '/nurses', label: '간호사 관리', adminOnly: true },
  { path: '/rules', label: '근무 규칙', adminOnly: true },
  { path: '/schedules', label: '근무표', adminOnly: false },
  { path: '/requests', label: '근무 요청', adminOnly: false },
  { path: '/stats', label: '통계', adminOnly: false },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { nurse, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🏥</span>
          <span className="brand-text">NurseSch</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item${location.pathname === item.path ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{nurse?.name}</div>
            <div className="user-role">{nurse?.grade} {isAdmin ? '(관리자)' : ''}</div>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={handleLogout}>로그아웃</button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
