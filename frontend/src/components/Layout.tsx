import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

const NAV_ITEMS = [
  { path: '/', label: '대시보드', icon: '📊', adminOnly: false },
  { path: '/nurses', label: '간호사 관리', icon: '👩‍⚕️', adminOnly: true },
  { path: '/rules', label: '근무 규칙', icon: '⚙️', adminOnly: true },
  { path: '/schedules', label: '근무표', icon: '📋', adminOnly: false },
  { path: '/requests', label: '근무 요청', icon: '📝', adminOnly: false },
  { path: '/stats', label: '통계', icon: '📈', adminOnly: false },
];

const GRADE_LABEL: Record<string, string> = {
  HN: '수간호사', CN: '책임간호사', RN: '평간호사', AN: '보조간호사', PN: '임시간호사',
};

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
        <div className="sidebar-header">
          <div className="logo text-gradient">
            <span className="logo-icon">🏥</span>
            <span>NurseSch</span>
          </div>
        </div>

        <nav className="nav-links">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item${location.pathname === item.path ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '0 12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1.2rem', color: 'white',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
            }}>
              {nurse?.name?.[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{nurse?.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {nurse?.grade && GRADE_LABEL[nurse.grade]}
                {isAdmin ? ' · 관리자' : ''}
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            로그아웃
          </button>
        </div>
      </aside>

      <main className="main-content animate-fade-in">
        {children}
      </main>
    </div>
  );
}
