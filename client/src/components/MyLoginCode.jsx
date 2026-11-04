import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { api, errMsg } from "../api/client";
import { Alert, Badge, Button, Card, Modal } from "./ui";
import AuthField from "./AuthField";
import ConfirmDialog from "./ConfirmDialog";
import { fmtDateTime } from "../utils/dates";

const COPY = {
  create: { title: "Make your login code", text: "A code lets you sign in by scanning a QR code or typing the code, without your password." },
  reveal: { title: "Show your login code", text: "Confirm it is you before the code is shown." },
  replace: { title: "Make a new login code", text: "Your current code will stop working right away, and the new one replaces it." },
};

export default function MyLoginCode() {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null); // "create" | "reveal" | "replace"
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(null);
  const [revokeAsk, setRevokeAsk] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/profile/login-code");
      setS(r.data);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const start = (a) => { setAction(a); setPw(""); setErr(""); };

  async function run(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const body = pw ? { currentPassword: pw } : {};
      const r = action === "reveal"
        ? await api.post("/profile/login-code/reveal", body)
        : await api.post("/profile/login-code", body);
      setCode(r.data.code);
      setAction(null);
      setPw("");
      await load();
    } catch (error2) {
      setErr(errMsg(error2)); // shown inside the popup
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api.delete("/profile/login-code");
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
      setRevokeAsk(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  // Draws the QR on a white card with the code underneath, and saves it as a PNG
  function saveImage() {
    const src = canvasRef.current;
    if (!src) return;
    const pad = 40;
    const out = document.createElement("canvas");
    out.width = src.width + pad * 2;
    out.height = src.height + pad * 2 + 70;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, pad, pad);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "center";
    ctx.fillText(code, out.width / 2, src.height + pad + 55);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = "meenal-login-code.png";
    a.click();
  }

  const qrUrl = code ? `${window.location.origin}/login?tab=code#c=${code.replace(/-/g, "")}` : "";

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-lg font-extrabold">🎟️ My login code</h3>
        <p className="text-xs font-semibold opacity-60">
          Sign in by scanning a QR code or typing a code. Only you can make it, see it or remove it here.
        </p>
      </div>

      <Alert>{error}</Alert>
      {!s && !error && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}

      {s && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.hasCode ? "green" : "gray"}>{s.hasCode ? "Active" : "No code yet"}</Badge>
            {s.hasCode && (
              <span className="text-xs font-semibold opacity-70">
                Made {fmtDateTime(s.createdAt)}{s.lastUsedAt ? ` · last used ${fmtDateTime(s.lastUsedAt)}` : " · not used yet"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {s.hasCode ? (
              <>
                <Button onClick={() => start("reveal")}>👁️ Show code & QR</Button>
                <Button variant="soft" onClick={() => start("replace")}>Make a new code</Button>
                <Button variant="danger" onClick={() => setRevokeAsk(true)}>Remove code</Button>
              </>
            ) : (
              <Button onClick={() => start("create")}>🎟️ Make my login code</Button>
            )}
          </div>
        </>
      )}

      <Modal open={!!action} onClose={() => !busy && setAction(null)} title={action ? COPY[action].title : ""}>
        {action && (
          <form className="space-y-3" onSubmit={run}>
            <p className="text-sm font-semibold opacity-80">{COPY[action].text}</p>
            {s?.hasPassword && (
              <AuthField label="Your password" icon="🔑" type="password" required autoFocus autoComplete="current-password"
                value={pw} onChange={(e) => setPw(e.target.value)} />
            )}
            <Alert>{err}</Alert>
            <div className="flex gap-2">
              <Button disabled={busy}>{busy ? "Please wait…" : "Continue"}</Button>
              <Button type="button" variant="soft" disabled={busy} onClick={() => setAction(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!code} onClose={() => setCode(null)} title="Your login code">
        {code && (
          <div className="space-y-3 text-center text-sm">
            <div className="mx-auto w-fit rounded-2xl bg-white p-4 ring-1 ring-brand-100">
              <QRCodeCanvas ref={canvasRef} value={qrUrl} size={220} level="M" />
            </div>
            <div className="break-all rounded-2xl bg-brand-50 p-3 font-mono text-xl font-extrabold tracking-widest dark:bg-slate-800">
              {code}
            </div>
            <p className="text-xs font-semibold opacity-70">
              Scan the QR with a phone camera, or type the code on the sign-in page (Login code tab).
              Keep it private: anyone who has it can sign in as you. If you think someone saw it, make a new code.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="soft" onClick={copy}>{copied ? "Copied ✅" : "Copy code"}</Button>
              <Button variant="soft" onClick={saveImage}>⬇️ Save QR as image</Button>
              <Button onClick={() => setCode(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={revokeAsk}
        icon="🎟️"
        title="Remove your login code?"
        message="The code and its QR will stop working. You can make a new one any time."
        confirmText="Yes, remove"
        cancelText="Keep it"
        busy={busy}
        onConfirm={revoke}
        onCancel={() => setRevokeAsk(false)}
      />
    </Card>
  );
}