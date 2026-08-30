import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ClassPage from "./pages/ClassPage";
import AttendancePage from "./pages/AttendancePage";
import AdminPage from "./pages/AdminPage";

function Protected() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  return <AppShell />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loader"><img src="/logo.png" alt="" /><span>Preparing your workspace…</span></div>;
  return <Routes>
    <Route path="/auth" element={user ? <Navigate to={user.role === "ADMIN" ? "/admin" : "/dashboard"} replace /> : <AuthPage />} />
    <Route element={<Protected />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/classes/:classId" element={<ClassPage />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Route>
    <Route path="*" element={<Navigate to={user?.role === "ADMIN" ? "/admin" : user ? "/dashboard" : "/auth"} replace />} />
  </Routes>;
}
