import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useLive } from "../context/SocketContext";
import { Alert, Button, Modal, cx } from "./ui";
import { disablePush, enablePush, pushState } from "../utils/push";
import { fmtDateTime } from "../utils/dates";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [push, setPush] = useState("off");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/notifications");
      setItems(r.data.items);
      setUnread(r.data.unread);
    } catch {
      /* the bell stays quiet if the server is unreachable */
    }
  }, []);
  useEffect(() => { load(); pushState().then(setPush).catch(() => {}); }, [load]);
  useLive("notify:new", load);

  async function openPanel() {
    setOpen(true);
    setErr("");
    if (unread) {
      try { await api.post("/notifications/read-all"); setUnread(0); } catch { /* ignore */ }
    }
  }

  async function togglePush() {
    setBusy(true);
    setErr("");
    try {
      if (push === "on") await disablePush();
      else await enablePush();
      setPush(await pushState());
    } catch (e) {
      setErr(e.response ? errMsg(e) : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
                <button
        onClick={openPanel}
        aria-label="Notifications"
        className="bouncy relative rounded-full bg-white/70 px-2.5 py-1.5 text-base dark:bg-slate-700"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-xs font-extrabold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Notifications">
        <div className="space-y-3 text-sm">
          {push !== "unsupported" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
              <span className="font-bold">
                {push === "on" ? "Phone alerts are on" : push === "blocked" ? "Alerts are blocked in this browser" : "Get alerts on this device"}
              </span>
              {push !== "blocked" && (
                <Button variant={push === "on" ? "soft" : "primary"} className="!px-3 !py-1.5" disabled={busy} onClick={togglePush}>
                  {push === "on" ? "Turn off" : "Turn on"}
                </Button>
              )}
            </div>
          )}
          <Alert>{err}</Alert>

          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {items.map((n) => (
              <div key={n._id} className={cx("rounded-2xl p-3", n.readAt ? "bg-gray-100 dark:bg-slate-900" : "bg-brand-50 dark:bg-slate-800")}>
                <div className="font-extrabold">{n.title}</div>
                <div className="break-words opacity-80">{n.body}</div>
                <div className="mt-1 text-xs opacity-60">{fmtDateTime(n.createdAt)}</div>
              </div>
            ))}
            {!items.length && <p className="opacity-60">No notifications yet.</p>}
          </div>
        </div>
      </Modal>
    </>
  );
}