import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import Layout from './components/Layout.tsx';
import LoginPage from './pages/LoginPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import NursesPage from './pages/NursesPage.tsx';
import RulesPage from './pages/RulesPage.tsx';
import SchedulePage from './pages/SchedulePage.tsx';
import ScheduleViewPage from './pages/ScheduleViewPage.tsx';
import RequestsPage from './pages/RequestsPage.tsx';
import StatsPage from './pages/StatsPage.tsx';
import { logs } from './api.ts';
import './styles/global.css';

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { nurse, isAdmin, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>로딩 중...</div>;
  if (!nurse) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

/** 페이지 뷰 로깅 — 경로 변경 시 서버에 기록 */
function PageViewLogger() {
  const location = useLocation();
  useEffect(() => {
    logs.pageView(location.pathname).catch(() => {});
  }, [location.pathname]);
  return null;
}

function App() {
  const { nurse } = useAuth();
  return (
    <BrowserRouter>
      <PageViewLogger />
      <Routes>
        <Route path="/login" element={nurse ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout><DashboardPage /></Layout></PrivateRoute>} />
        <Route path="/nurses" element={<PrivateRoute adminOnly><Layout><NursesPage /></Layout></PrivateRoute>} />
        <Route path="/rules" element={<PrivateRoute adminOnly><Layout><RulesPage /></Layout></PrivateRoute>} />
        <Route path="/schedules" element={<PrivateRoute><Layout><SchedulePage /></Layout></PrivateRoute>} />
        <Route path="/schedules/:id" element={<PrivateRoute><Layout><ScheduleViewPage /></Layout></PrivateRoute>} />
        <Route path="/requests" element={<PrivateRoute><Layout><RequestsPage /></Layout></PrivateRoute>} />
        <Route path="/stats" element={<PrivateRoute><Layout><StatsPage /></Layout></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function Root() {
  return <AuthProvider><App /></AuthProvider>;
}
