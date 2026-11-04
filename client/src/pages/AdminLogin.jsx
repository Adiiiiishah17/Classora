import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";
import { Alert, Button } from "../components/ui";
import AuthSplit from "../components/AuthSplit";
import AuthField from "../components/AuthField";
import { homeFor } from "../components/ProtectedRoute";

export default function AdminLogin() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={user.mustChangePassword ? "/change-password" : homeFor(user.role)} replace />;
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email, password, "admin");
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplit>
        <div className="text-center">
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
            Admin only
          </span>
          <h1 className="mt-3 bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-3xl font-extrabold text-transparent">
            Admin Sign In
          </h1>
          <p className="mt-1 text-sm font-semibold opacity-70">
            Authorized school staff only 🔒
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <AuthField label="Admin email" icon="📧" type="email" autoComplete="username" required
            placeholder="admin@school.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <AuthField label="Password" icon="🔑" type="password" autoComplete="current-password" required
            placeholder="Your admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
               <div className="text-right">
  <Link to="/forgot-password" className="text-xs font-extrabold text-brand-600 hover:underline dark:text-brand-300">
    Forgot password?
  </Link>
</div>
          <Alert>{error}</Alert>
          <Button className="w-full !py-3 text-base" disabled={busy}>
            {busy ? "Signing in… ⏳" : "Open dashboard 🚀"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs font-semibold opacity-70">
          Student or teacher?{" "}
          <Link to="/login" className="font-extrabold text-brand-600 hover:underline dark:text-brand-300">
            Sign in here 🎒
          </Link>
        </p>
      </AuthSplit>
  );
}