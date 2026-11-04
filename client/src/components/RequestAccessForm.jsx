import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, Button, cx } from "./ui";
import AuthField from "./AuthField";
import PasswordChecklist from "./PasswordChecklist";
import { homeFor } from "./ProtectedRoute";
import { passwordProblem } from "../utils/passwordPolicy";
import { splitList } from "../utils/text";
import { PHONE_HINT, cleanPhone, isValidEmail, isValidPhone } from "../utils/validators";
import { todayStr } from "../utils/dates";

const emptyForm = {
  role: "student",
  name: "",
  email: "",
  username: "",
  phone: "",
  dob: "",
  className: "",
  classNames: "",
  subjects: "",
  password: "",
  confirm: "",
  message: "",
  website: "", // hidden bot trap
};

export default function RequestAccessForm({ onDone }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("check"); // check | login | form | pending | sent
  const [identifier, setIdentifier] = useState("");
  const [known, setKnown] = useState("");
  const [password, setPassword] = useState("");
  const [f, setF] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function onIdentifier(e) {
    const v = e.target.value;
    setIdentifier(v.includes("@") || /[a-z]/i.test(v) ? v : cleanPhone(v));
  }

  async function check(e) {
    e.preventDefault();
    setError("");
    const v = identifier.trim();
    const isEmail = v.includes("@");
    if (isEmail ? !isValidEmail(v) : !isValidPhone(v)) {
      return setError(isEmail ? "Enter a valid email address, like name@example.com." : PHONE_HINT);
    }
    setBusy(true);
    try {
      const r = await api.post("/auth/check-identifier", { identifier: v });
      const { status, type, value } = r.data;
      if (status === "registered") {
        setKnown(value);
        setPassword("");
        setStep("login");
      } else if (status === "pending") {
        setStep("pending");
      } else {
        setF({ ...emptyForm, [type === "email" ? "email" : "phone"]: value });
        setStep("form");
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(known, password, "member");
      navigate(u.mustChangePassword ? "/change-password" : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!isValidEmail(f.email)) return setError("Enter a valid email address, like name@example.com.");
    if (!isValidPhone(f.phone)) return setError(PHONE_HINT);
        if (f.dob && f.dob > todayStr()) return setError("Date of birth cannot be in the future.");
    if (!/^(?=.*[a-z])[a-z0-9._]{3,30}$/i.test(f.username.trim())) {
      return setError("Username needs 3 to 30 characters with at least one letter (letters, numbers, dot, underscore).");
    }
    const problem = passwordProblem(f.password);
    if (problem) return setError(problem);
    if (f.password !== f.confirm) return setError("Passwords do not match.");

    const subjects = splitList(f.subjects);
    if (f.role === "teacher" && !subjects.length) return setError("Enter the subject you teach.");

    setBusy(true);
    try {
      await api.post("/auth/request-access", {
        role: f.role,
        name: f.name.trim(),
        email: f.email.trim(),
        username: f.username.trim(),
        phone: f.phone,
           ...(f.dob ? { dob: f.dob } : {}),
        password: f.password,
        ...(f.role === "student" && f.className.trim() ? { className: f.className.trim() } : {}),
        ...(f.role === "teacher" && splitList(f.classNames).length ? { classNames: splitList(f.classNames) } : {}),
        ...(subjects.length ? { subjects } : {}),
        ...(f.message.trim() ? { message: f.message.trim() } : {}),
        website: f.website,
      });
      setStep("sent");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  /* ---------- screens ---------- */

  if (step === "pending") {
    return (
      <div className="py-4 text-center">
        <div className="text-6xl">⏳</div>
        <h2 className="mt-3 text-2xl font-extrabold">Request already sent</h2>
        <p className="mt-2 text-sm font-semibold opacity-70">
          Your request is waiting for the school admin. You can sign in as soon as it is approved.
        </p>
        <Button className="mt-5" onClick={onDone}>Back to sign in</Button>
      </div>
    );
  }

  if (step === "sent") {
    return (
      <div className="py-4 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="mt-3 text-2xl font-extrabold">Request sent!</h2>
        <p className="mt-2 text-sm font-semibold opacity-70">
          The admin will review it. Once approved, sign in with your mobile number, email or username and the password you just chose.
        </p>
        <Button className="mt-5" onClick={onDone}>Back to sign in</Button>
      </div>
    );
  }

  if (step === "check") {
    return (
      <form className="space-y-4" onSubmit={check}>
        <p className="text-sm font-semibold opacity-70">
          Enter your mobile number. If you already have an account you can sign in right here. Otherwise we will help you register.
        </p>
        <AuthField label="Mobile number (or email)" icon="📱" type="text" required autoComplete="off"
          placeholder="9876543210" value={identifier} onChange={onIdentifier}
          error={
            identifier && !identifier.includes("@") && !/[a-z]/i.test(identifier) && identifier.length === 10 && !isValidPhone(identifier)
              ? PHONE_HINT
              : ""
          } />
        <Alert>{error}</Alert>
        <Button className="w-full !py-3 text-base" disabled={busy}>
          {busy ? "Checking… ⏳" : "Continue ➡️"}
        </Button>
      </form>
    );
  }

  if (step === "login") {
    return (
      <form className="space-y-4" onSubmit={signIn}>
        <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
          Welcome back! 🎉 <b>{known}</b> is already registered. Enter your password to sign in.
        </div>
        <AuthField label="Password" icon="🔑" type="password" required autoFocus autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-center justify-between text-xs font-extrabold">
          <button type="button" onClick={() => { setStep("check"); setError(""); }} className="text-brand-600 hover:underline dark:text-brand-300">
            ← Use a different number
          </button>
          <Link to="/forgot-password" className="text-brand-600 hover:underline dark:text-brand-300">Forgot password?</Link>
        </div>
        <Alert>{error}</Alert>
        <Button className="w-full !py-3 text-base" disabled={busy}>
          {busy ? "Signing in… ⏳" : "Sign in 🚀"}
        </Button>
      </form>
    );
  }

  /* ---------- step === "form": full registration ---------- */
  return (
    <form className="space-y-4" onSubmit={submit}>
      <button type="button" onClick={() => { setStep("check"); setError(""); }} className="text-xs font-extrabold text-brand-600 hover:underline dark:text-brand-300">
        ← Use a different number
      </button>

      <div>
        <span className="mb-1.5 block text-sm font-bold">I am a… *</span>
        <div className="grid grid-cols-2 gap-2">
          {[["student", "🎒 Student"], ["teacher", "👩‍🏫 Teacher"]].map(([val, label]) => (
            <button
              type="button"
              key={val}
              onClick={() => setF({ ...f, role: val })}
              className={cx("bouncy rounded-2xl border-2 px-4 py-3 text-sm font-extrabold",
                f.role === val
                  ? "border-brand-500 bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"
                  : "border-brand-200 dark:border-slate-700")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs font-semibold opacity-60">Fields marked * are required.</p>

      <AuthField label="Full name *" icon="🙂" required maxLength={100} value={f.name} onChange={set("name")} />
      <AuthField label="Email *" icon="📧" type="email" required value={f.email} onChange={set("email")}
        error={f.email && !isValidEmail(f.email) ? "Enter a valid email, like name@example.com" : ""} />
      <AuthField label="Username *" icon="🏷️" required minLength={3} maxLength={30} autoComplete="off"
        value={f.username} onChange={set("username")} />
      <AuthField label="Personal mobile number (10 digits) *" icon="📱" type="tel" inputMode="numeric" required
        maxLength={10} placeholder="9876543210" value={f.phone}
        onChange={(e) => setF({ ...f, phone: cleanPhone(e.target.value) })}
        error={f.phone && !isValidPhone(f.phone) && f.phone.length >= 10 ? PHONE_HINT : f.phone && f.phone.length < 10 ? `${10 - f.phone.length} more digit${10 - f.phone.length === 1 ? "" : "s"} needed` : ""} />

      {f.role === "student" ? (
        <>
          <AuthField label="Your class (optional)" icon="🏫" maxLength={40} placeholder="10-A"
            value={f.className} onChange={set("className")} />
          <AuthField label="Subject(s) you study (optional, comma separated)" icon="📚" placeholder="Maths, Physics"
            value={f.subjects} onChange={set("subjects")} />
                  <AuthField label="Date of birth (optional)" icon="🎂" type="date" max={todayStr()}
        value={f.dob} onChange={set("dob")} />
        </>

      ) : (
        <>
          <AuthField label="Class(es) you teach (optional, comma separated)" icon="🏫" placeholder="10-A, 9-B"
            value={f.classNames} onChange={set("classNames")} />
          <AuthField label="Subject(s) you teach * (comma separated)" icon="📚" required placeholder="Maths, Physics"
            value={f.subjects} onChange={set("subjects")} />
        </>
      )}

      <AuthField label="Password *" icon="🔑" type="password" required autoComplete="new-password"
        value={f.password} onChange={set("password")} />
      <PasswordChecklist value={f.password} />
      <AuthField label="Confirm password *" icon="✅" type="password" required autoComplete="new-password"
        value={f.confirm} onChange={set("confirm")}
        error={f.confirm && f.confirm !== f.password ? "Passwords do not match" : ""} />

      <AuthField label="Message to the admin (optional)" icon="💬" maxLength={300}
        value={f.message} onChange={set("message")} />

      {/* Bot trap: invisible to people, bots fill it in */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={f.website} onChange={set("website")}
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
      />

      <Alert>{error}</Alert>
      <Button className="w-full !py-3 text-base" disabled={busy}>
        {busy ? "Sending… ⏳" : "Send request 📨"}
      </Button>
    </form>
  );
}