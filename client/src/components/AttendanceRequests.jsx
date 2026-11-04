import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, Field, Modal, cx } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import FormModal from "./FormModal";
import { ATT, LEAVE_TONE } from "../utils/status";
import { addDaysStr, fmtDate, fmtDateTime, todayStr } from "../utils/dates";

/* ---------- teacher: send and follow requests ---------- */
export function MyAttendanceRequests() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ date: todayStr(), note: "" });
  const [formErr, setFormErr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/attendance/requests/mine");
      setItems(r.data.items);
      setError("");
    } catch (e) {
      setItems([]);
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useLive("attreq:decided", (p) => {
    toast(p?.status === "approved" ? "✅ Your attendance request was approved." : "❌ Your attendance request was rejected.");
    load();
  });

  const open = () => { setF({ date: todayStr(), note: "" }); setFormErr(""); setShow(true); };

  async function submit(e) {
    e.preventDefault();
    setFormErr("");
    setBusy(true);
    try {
      await api.post("/attendance/requests", { date: f.date, note: f.note.trim() });
      toast("📨 Request sent to the admin.");
      setShow(false);
      await load();
    } catch (err) {
      setFormErr(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.post(`/attendance/requests/${cancelling._id}/cancel`);
      toast("Request cancelled.");
      setCancelling(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
      setCancelling(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Attendance requests</h2>

        </div>
        <Button onClick={open}>🙋 Request attendance</Button>
      </div>

      <Alert>{error}</Alert>

      <Card>
        <div className="space-y-3">
          {(items || []).map((l) => (
            <div key={l._id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-brand-50 p-3 sm:p-4 dark:bg-slate-800">
              <div className="min-w-0">
                <div className="font-extrabold">{fmtDate(l.date)}</div>
                <p className="mt-1 break-words text-sm opacity-80">{l.note}</p>
                {l.decisionNote && (
                  <p className="mt-1 text-xs font-semibold italic opacity-70">“{l.decisionNote}” {l.decidedBy?.name ? `· ${l.decidedBy.name}` : ""}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={LEAVE_TONE[l.status]}>{l.status}</Badge>
                {l.status === "pending" && (
                  <Button variant="danger" className="!px-3 !py-1" onClick={() => setCancelling(l)}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
          {items && !items.length && <p className="text-sm opacity-60">No requests yet.</p>}
          {!items && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}
        </div>
      </Card>

      {show && (
        <FormModal title="Request attendance" onClose={() => setShow(false)}>
          <form className="space-y-3" onSubmit={submit}>
            <Field label="Date *" type="date" required min={addDaysStr(todayStr(), -30)} max={todayStr()} value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })} />
            <label className="block text-sm font-semibold">
              <span className="mb-1 block">Note *</span>
              <textarea
                required
                rows={4}
                minLength={5}
                maxLength={300}
                value={f.note}
                onChange={(e) => setF({ ...f, note: e.target.value })}
                className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>

            <Alert>{formErr}</Alert>
            <div className="flex gap-2">
              <Button disabled={busy}>{busy ? "Sending…" : "Send request"}</Button>
              <Button type="button" variant="soft" onClick={() => setShow(false)}>Cancel</Button>
            </div>
          </form>
        </FormModal>
      )}

      <ConfirmDialog
        open={!!cancelling}
        icon="🙋"
        title="Cancel this request?"
        message="The request will be withdrawn. You can send it again later."
        confirmText="Yes, cancel it"
        cancelText="Keep it"
        busy={busy}
        busyText="Cancelling…"
        onConfirm={cancel}
        onCancel={() => setCancelling(null)}
      />
    </div>
  );
}

/* ---------- admin: decide ---------- */
const FILTERS = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]];

export function AttendanceRequestInbox() {
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState(null); // { req, decision }
  const [note, setNote] = useState("");
  const [modalErr, setModalErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/attendance/requests/inbox", { params: { status } });
      setItems(r.data.items);
      setError("");
    } catch (e) {
      setItems([]);
      setError(errMsg(e));
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  useLive("attreq:new", () => load());
  useLive("attreq:handled", () => load());

  const open = (req, decision) => { setTarget({ req, decision }); setNote(""); setModalErr(""); };
  const approving = target?.decision === "approve";

  async function decide() {
    setBusy(true);
    setModalErr("");
    try {
      await api.post(`/attendance/requests/${target.req._id}/decision`, {
        decision: target.decision,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast(approving ? `✅ ${target.req.teacherId?.name} is now marked present` : "Request rejected");
      setTarget(null);
      await load();
    } catch (e) {
      setModalErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => { setItems(null); setStatus(k); }}
            className={cx("bouncy rounded-full px-4 py-1.5 text-xs font-extrabold",
              status === k ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-brand-200")}>
            {label}
          </button>
        ))}
      </div>

      <Alert>{error}</Alert>

      <Card>
        <div className="space-y-3">
          {(items || []).map((r) => (
            <div key={r._id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-brand-50 p-3 sm:p-4 dark:bg-slate-800">
              <div className="min-w-0">
                <div className="font-extrabold">👩‍🏫 {r.teacherId?.name} <span className="text-xs font-bold opacity-60">@{r.teacherId?.username}</span></div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-bold">
                  {fmtDate(r.date)}
                  {r.current ? <span className={cx("rounded-full px-2 py-0.5 text-xs", ATT[r.current].cell)}>Now: {ATT[r.current].label}</span>
                    : <Badge tone="amber">Not marked</Badge>}
                </div>
                <p className="mt-1 break-words text-sm opacity-80">{r.note}</p>
                <div className="mt-1 text-xs opacity-60">Sent {fmtDateTime(r.createdAt)}</div>
                {r.status !== "pending" && (
                  <div className="mt-1 text-xs font-semibold opacity-80">
                    {r.status} {r.decidedBy?.name ? `by ${r.decidedBy.name}` : ""}{r.decisionNote ? ` · “${r.decisionNote}”` : ""}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={LEAVE_TONE[r.status]}>{r.status}</Badge>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button className="!px-3 !py-1.5" onClick={() => open(r, "approve")}>Approve</Button>
                    <Button variant="danger" className="!px-3 !py-1.5" onClick={() => open(r, "reject")}>Reject</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {items && !items.length && <p className="text-sm opacity-60">Nothing here. 🎉</p>}
          {!items && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}
        </div>
      </Card>

      <Modal open={!!target} onClose={() => !busy && setTarget(null)} title={approving ? "Approve this request?" : "Reject this request?"}>
        {target && (
          <div className="space-y-3 text-sm">
                        <p className="font-semibold opacity-80">{target.req.teacherId?.name}, {fmtDate(target.req.date)}.</p>
            <Field label={approving ? "Note (optional)" : "Reason for rejecting *"} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
            <Alert>{modalErr}</Alert>
            <div className="flex gap-2">
              <Button variant={approving ? "primary" : "danger"} disabled={busy || (!approving && !note.trim())} onClick={decide}>
                {busy ? "Saving…" : approving ? "Yes, approve" : "Yes, reject"}
              </Button>
              <Button variant="soft" disabled={busy} onClick={() => setTarget(null)}>Not yet</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}