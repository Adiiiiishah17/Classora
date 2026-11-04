import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";
import { Alert, Button, Spinner } from "../components/ui";
import AuthShell, { AuthCard } from "../components/AuthShell";
import AuthField from "../components/AuthField";
import { homeFor } from "../components/ProtectedRoute";
import PasswordChecklist from "../components/PasswordChecklist";
import { passwordProblem } from "../utils/passwordPolicy";

export default function ChangePassword() {
  const { user, loading, changePassword } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;

  async function submit(e) {
    e.preventDefault();
    setError("");
        const problem = passwordProblem(f.next);
    if (problem) return setError(problem);
    if (f.next !== f.confirm) return setError("New passwords do not match.");
    setBusy(true);
    try {
      await changePassword(f.current, f.next);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard mascot="🔐">
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-3xl font-extrabold text-transparent">
            Set your password
          </h1>
          <p className="mt-1 text-sm font-semibold opacity-70">
            {user.mustChangePassword
              ? "Your account uses a temporary password. Choose your own to continue."
              : "Choose a new password."}
          </p>
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <AuthField label="Current (temporary) password" icon="🔑" type="password" required
            autoComplete="current-password" value={f.current} onChange={set("current")} />
          <AuthField label="New password" icon="✨" type="password" required
            autoComplete="new-password" value={f.next} onChange={set("next")} />
            <PasswordChecklist value={f.next} />
          <AuthField label="Confirm new password" icon="✅" type="password" required
            autoComplete="new-password" value={f.confirm} onChange={set("confirm")} />
          <Alert>{error}</Alert>
          <Button className="w-full !py-3 text-base" disabled={busy}>
            {busy ? "Saving… ⏳" : "Save password 🎉"}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}