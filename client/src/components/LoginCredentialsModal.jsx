import { useState } from "react";
import { api } from "../api/client";
import { Badge, Button, Modal } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import { fmtDateTime } from "../utils/dates";

const CONFIRM = {
  reset: {
    icon: "🔑",
    title: "Reset this password?",
    message: (n) => `${n} will be signed out everywhere and given a temporary password to change at the next sign-in.`,
    text: "Yes, reset",
  },
  replace: {
    icon: "🎟️",
    title: "Make a new login code?",
    message: (n) => `${n}'s current code will stop working immediately.`,
    text: "Yes, make new code",
  },
  revoke: {
    icon: "🎟️",
    title: "Revoke this login code?",
    message: (n) => `${n} will no longer be able to sign in with a code.`,
    text: "Yes, revoke",
  },
};

export default function LoginCredentialsModal({ u, act, setSecret, setCodeInfo, onClose }) {
  const [ask, setAsk] = useState(null); // "reset" | "replace" | "revoke"
  const [busy, setBusy] = useState(false);
  const hasCode = !!u.loginCodeCreatedAt;

  const makeCode = () =>
    act(async () => {
      const r = await api.post(`/admin/users/${u._id}/login-code`);
      setCodeInfo({ name: u.name, code: r.data.code });
    });

  const viewCode = () =>
    act(async () => {
      const r = await api.get(`/admin/users/${u._id}/login-code`);
      setCodeInfo({ name: u.name, code: r.data.code });
    });

  async function confirmAction() {
    const kind = ask;
    setBusy(true);
    let ok = true;
    if (kind === "reset") {
      ok = await act(async () => {
        const r = await api.post(`/admin/users/${u._id}/reset-password`);
        setSecret({ name: u.name, email: u.email, tempPassword: r.data.tempPassword });
      });
    } else if (kind === "replace") {
      ok = await makeCode();
    } else {
      ok = await act(() => api.delete(`/admin/users/${u._id}/login-code`));
    }
    setBusy(false);
    setAsk(null);
    if (ok && kind === "reset") onClose(); // the temporary password popup takes over
  }

  const c = ask ? CONFIRM[ask] : null;

  return (
    <>
      <Modal open onClose={() => !busy && onClose()} title={`Login credentials · ${u.name}`}>
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
            <div className="font-extrabold">🔑 Password</div>
            <p className="mt-1 text-xs font-semibold opacity-70">
              Passwords are stored scrambled, so nobody can read them. A reset makes a temporary password that {u.name} must change at the next sign-in.
            </p>
            <Button variant="soft" className="mt-2 !px-3 !py-1.5" onClick={() => setAsk("reset")}>Reset password</Button>
          </div>

          <div className="rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
            <div className="flex flex-wrap items-center gap-2 font-extrabold">
              🎟️ Login code
              <Badge tone={hasCode ? "green" : "gray"}>{hasCode ? "Active" : "None"}</Badge>
            </div>
            {hasCode && (
              <p className="mt-1 text-xs font-semibold opacity-70">
                Made {fmtDateTime(u.loginCodeCreatedAt)}
                {u.loginCodeLastUsedAt ? ` · last used ${fmtDateTime(u.loginCodeLastUsedAt)}` : " · not used yet"}
              </p>
            )}
            {!u.isActive && (
              <p className="mt-1 text-xs font-bold text-rose-600 dark:text-rose-300">
                This account is disabled. Enable it to make a code.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {hasCode ? (
                <>
                  <Button className="!px-3 !py-1.5" onClick={viewCode}>👁️ View code</Button>
                  <Button variant="soft" className="!px-3 !py-1.5" disabled={!u.isActive} onClick={() => setAsk("replace")}>Replace code</Button>
                  <Button variant="danger" className="!px-3 !py-1.5" onClick={() => setAsk("revoke")}>Revoke code</Button>
                </>
              ) : (
                <Button variant="soft" className="!px-3 !py-1.5" disabled={!u.isActive} onClick={makeCode}>🎟️ Create code</Button>
              )}
            </div>
          </div>

          <Button variant="soft" onClick={onClose}>Close</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!ask}
        icon={c?.icon}
        title={c?.title}
        message={c ? c.message(u.name) : ""}
        confirmText={c?.text}
        cancelText="Cancel"
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => setAsk(null)}
      />
    </>
  );
}