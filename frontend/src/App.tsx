import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Layout } from './components/Layout.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { NursesPage } from './pages/NursesPage.tsx';
import { RulesPage } from './pages/RulesPage.tsx';
import { SchedulePage } from './pages/SchedulePage.tsx';
import { ScheduleViewPage } from './pages/ScheduleViewPage.tsx';
import { RequestsPage } from './pages/RequestsPage.tsx';
import { StatsPage } from './pages/StatsPage.tsx';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">로딩 중...</div>;
  if (!user) return <LoginPage />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/nurses" element={<NursesPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/schedule/:id" element={<ScheduleViewPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/stats/:id" element={<StatsPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
