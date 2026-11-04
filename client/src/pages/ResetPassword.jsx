import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, errMsg } from "../api/client";
import { Alert, Button } from "../components/ui";
import AuthShell, { AuthCard } from "../components/AuthShell";
import AuthField from "../components/AuthField";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token] = useState(() => params.get("token") || "");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneRole, setDoneRole] = useState(null);

  // Remove the secret token from the address bar and browser history
  useEffect(() => {
    if (token) navigate("/reset-password", { replace: true });
  }, [token, navigate]);

  async function submit(e) {
    e.preventDefault();
    setError("");
      const problem = passwordProblem(pw);
    if (problem) return setError(problem);
    if (pw !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const r = await api.post("/auth/reset-password", { token, newPassword: pw });
      setDoneRole(r.data.role);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (!token && !doneRole) {
    return (
      <AuthShell>
        <AuthCard mascot="⚠️">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold">Link missing or expired</h1>
            <p className="mt-2 text-sm font-semibold opacity-70">
              Open the link from your email again, or ask for a new one.
            </p>
            <Link to="/forgot-password" className="bouncy mt-5 inline-block rounded-full bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-2.5 text-sm font-extrabold text-white">
              Get a new link
            </Link>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (doneRole) {
    return (
      <AuthShell>
        <AuthCard mascot="🎉">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold">Password updated!</h1>
            <p className="mt-2 text-sm font-semibold opacity-70">
              You were signed out everywhere for safety. Sign in with your new password.
            </p>
            <Link
              to={doneRole === "admin" ? "/admin/login" : "/login"}
              className="bouncy mt-5 inline-block rounded-full bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-2.5 text-sm font-extrabold text-white"
            >
              Go to sign in 🚀
            </Link>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard mascot="🔐">
        <div className="text-center">
          <h1 className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-3xl font-extrabold text-transparent">
            Choose a new password
          </h1>
          <p className="mt-1 text-sm font-semibold opacity-70">Make it strong 💪</p>
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <AuthField label="New password" icon="✨" type="password" required autoComplete="new-password"
            value={pw} onChange={(e) => setPw(e.target.value)} />
            <PasswordChecklist value={pw} />
          <AuthField label="Confirm new password" icon="✅" type="password" required autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Alert>{error}</Alert>
          <Button className="w-full !py-3 text-base" disabled={busy}>
            {busy ? "Saving… ⏳" : "Save new password 🎉"}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}