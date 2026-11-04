import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errMsg } from "../api/client";
import { Alert, Button } from "../components/ui";
import AuthShell, { AuthCard } from "../components/AuthShell";
import AuthField from "../components/AuthField";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard mascot="🔑">
        {sent ? (
          <div className="py-2 text-center">
            <div className="text-6xl">📬</div>
            <h1 className="mt-3 text-2xl font-extrabold">Check your inbox</h1>
            <p className="mt-2 text-sm font-semibold opacity-70">
              If an account exists for <b>{email}</b>, we have sent a reset link. It is valid for 15 minutes.
              Check your spam folder too.
            </p>
            <Link to="/login" className="bouncy mt-5 inline-block rounded-full bg-brand-100 px-6 py-2.5 text-sm font-extrabold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-3xl font-extrabold text-transparent">
                Forgot password?
              </h1>
              <p className="mt-1 text-sm font-semibold opacity-70">
                Enter your email and we will send you a link to choose a new one 💌
              </p>
            </div>
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <AuthField label="Email" icon="📧" type="email" autoComplete="username" required
                placeholder="you@school.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Alert>{error}</Alert>
              <Button className="w-full !py-3 text-base" disabled={busy}>
                {busy ? "Sending… ⏳" : "Send reset link 📨"}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs font-semibold opacity-70">
              Remembered it?{" "}
              <Link to="/login" className="font-extrabold text-brand-600 hover:underline dark:text-brand-300">Back to sign in</Link>
            </p>
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}