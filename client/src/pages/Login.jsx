import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errMsg } from "../api/client";
import { Alert, Button, cx } from "../components/ui";
import AuthSplit from "../components/AuthSplit";
import AuthField from "../components/AuthField";
import GoogleButton from "../components/GoogleButton";
import RequestAccessForm from "../components/RequestAccessForm";
import { homeFor } from "../components/ProtectedRoute";

// A QR code opens /login?tab=code#c=THECODE
function codeFromHash() {
  const m = window.location.hash.match(/[#&]c=([A-Za-z0-9-]+)/);
  return m ? m[1].toUpperCase() : "";
}

const heading = {
  signin: ["Welcome back!", "Students and teachers, sign in to continue ✨"],
  code: ["Scan & go!", "Use the login code from your school 🎟️"],
  request: ["Join Meenal!", "Tell us who you are and the admin will approve your account 🎒"],
};

export default function Login() {
  const { user, login, codeLogin, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [code, setCode] = useState(codeFromHash);
  const [tab, setTab] = useState(() => {
    if (codeFromHash() || params.get("tab") === "code") return "code";
    return params.get("tab") === "request" ? "request" : "signin";
  });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Remove the secret from the address bar right away
  useEffect(() => {
    if (window.location.hash.includes("c=")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  if (user) {
    return <Navigate to={user.mustChangePassword ? "/change-password" : homeFor(user.role)} replace />;
  }

  async function attempt(fn) {
    setError("");
    setBusy(true);
    try {
      const u = await fn();
      navigate(u.mustChangePassword ? "/change-password" : homeFor(u.role), { replace: true });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const [title, subtitle] = heading[tab];

  return (
    <AuthSplit>
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-3xl font-extrabold text-transparent">
          {title}
        </h1>
        <p className="mt-1 text-sm font-semibold opacity-70">{subtitle}</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-brand-100 p-1 dark:bg-slate-800">
        {[["signin", "Sign in"], ["code", "Login code"], ["request", "Request account"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setError(""); }}
            className={cx("rounded-full px-2 py-2 text-xs font-extrabold transition sm:text-sm",
              tab === key ? "bg-white shadow dark:bg-slate-900" : "opacity-60 hover:opacity-100")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "signin" && (
          <>
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); attempt(() => login(identifier, password, "member")); }}
            >
              <AuthField label="Email, username or phone" icon="📧" type="text" autoComplete="username" required
                placeholder="you@school.com, username or phone"
                value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              <AuthField label="Password" icon="🔑" type="password" autoComplete="current-password" required
                placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs font-extrabold text-brand-600 hover:underline dark:text-brand-300">
                  Forgot password?
                </Link>
              </div>
              <Alert>{error}</Alert>
              <Button className="w-full !py-3 text-base" disabled={busy}>
                {busy ? "Signing in… ⏳" : "Let's go! 🚀"}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-bold opacity-60">
              <div className="h-px flex-1 bg-current opacity-30" /> OR <div className="h-px flex-1 bg-current opacity-30" />
            </div>
            <GoogleButton onCredential={(c) => attempt(() => googleLogin(c))} />
          </>
        )}

        {tab === "code" && (
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); attempt(() => codeLogin(code)); }}
          >
            <p className="text-sm font-semibold opacity-70">
              Scan your QR code with your phone camera and this page opens with the code filled in. Or type your login code.
            </p>
            <AuthField label="Login code" icon="🎟️" type="text" required autoComplete="off" spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <Alert>{error}</Alert>
            <Button className="w-full !py-3 text-base" disabled={busy}>
              {busy ? "Signing in… ⏳" : "Sign in with code 🚀"}
            </Button>
          </form>
        )}

        {tab === "request" && <RequestAccessForm onDone={() => setTab("signin")} />}
      </div>

      <p className="mt-6 text-center text-xs font-semibold opacity-70">
        School admin?{" "}
        <Link to="/admin/login" className="font-extrabold text-brand-600 hover:underline dark:text-brand-300">
          Admin sign in 🛡️
        </Link>
      </p>
    </AuthSplit>
  );
}