import { useState } from "react";
import { Link } from "react-router-dom";
import { errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, Button, Card } from "./ui";
import AuthField from "./AuthField";
import PasswordChecklist from "./PasswordChecklist";
import { passwordProblem } from "../utils/passwordPolicy";

export default function ChangePasswordCard({ hasPassword = true }) {
  const { changePassword } = useAuth();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setOk(false); };

  async function submit(e) {
    e.preventDefault();
    setError("");
    setOk(false);
    const problem = passwordProblem(f.next);
    if (problem) return setError(problem);
    if (f.next !== f.confirm) return setError("The new passwords do not match.");
    setBusy(true);
    try {
      await changePassword(f.current, f.next);
      setF({ current: "", next: "", confirm: "" });
      setOk(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (!hasPassword) {
    return (
      <Card className="space-y-2">
        <h3 className="text-lg font-extrabold">🔐 Password</h3>
        <p className="text-sm font-semibold opacity-80">
          You sign in with Google or a login code, so you have no password yet. Use{" "}
          <Link to="/forgot-password" className="font-extrabold text-brand-600 underline dark:text-brand-300">Forgot password</Link>{" "}
          to create one by email.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-1 text-lg font-extrabold">🔐 Change password</h3>
      <p className="mb-3 text-xs font-semibold opacity-60">
        You will stay signed in here and be signed out on every other device.{" "}
        <Link to="/forgot-password" className="font-extrabold text-brand-600 underline dark:text-brand-300">Forgot your current password?</Link>
      </p>
      <form className="space-y-3" onSubmit={submit}>
        <AuthField label="Current password" icon="🔑" type="password" required autoComplete="current-password"
          value={f.current} onChange={set("current")} />
        <AuthField label="New password" icon="✨" type="password" required autoComplete="new-password"
          value={f.next} onChange={set("next")} />
        <PasswordChecklist value={f.next} />
        <AuthField label="Confirm new password" icon="✅" type="password" required autoComplete="new-password"
          value={f.confirm} onChange={set("confirm")}
          error={f.confirm && f.confirm !== f.next ? "Passwords do not match" : ""} />
        <Alert>{error}</Alert>
        {ok && (
          <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-extrabold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
            ✅ Your password was changed.
          </div>
        )}
        <Button disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
      </form>
    </Card>
  );
}