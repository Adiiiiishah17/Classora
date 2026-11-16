import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute, { homeFor } from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import StudentHome from "./pages/student/StudentHome";
import TeacherHome from "./pages/Teacher/TeacherHome";
import AdminDashboard from "./pages/admin/AdminDashboard";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.mustChangePassword ? "/change-password" : homeFor(user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/signup" element={<Navigate to="/login?tab=request" replace />} />
      <Route path="/request-access" element={<Navigate to="/login?tab=request" replace />} />
      <Route path="/change-password" element={<ChangePassword />} />

      <Route element={<ProtectedRoute roles={["admin"]} loginPath="/admin/login" />}>
        <Route element={<Layout />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["teacher"]} loginPath="/login" />}>
        <Route element={<Layout />}>
          <Route path="/teacher" element={<TeacherHome />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["student"]} loginPath="/login" />}>
        <Route element={<Layout />}>
          <Route path="/student" element={<StudentHome />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}