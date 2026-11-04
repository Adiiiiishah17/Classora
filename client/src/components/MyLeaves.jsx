import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, Field } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import FormModal from "./FormModal";
import { LEAVE_TONE } from "../utils/status";
import { addDaysStr, daysInclusive, fmtRange, todayStr } from "../utils/dates";

export default function MyLeaves({ approver = "your teacher" }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [show, setShow] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [f, setF] = useState({ fromDate: todayStr(), toDate: todayStr(), reason: "" });
  const [formErr, setFormErr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/leaves/mine");
      setItems(r.data.items);
      setError("");
    } catch (e) {
      setItems([]);
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useLive("leave:decided", (p) => {
    toast(p?.status === "approved" ? "✅ Your leave request was approved." : "❌ Your leave request was rejected.");
    load();
  });

  const open = () => { setF({ fromDate: todayStr(), toDate: todayStr(), reason: "" }); setFormErr(""); setShow(true); };

  // Step 1: the form is filled in, ask for confirmation
  function submit(e) {
    e.preventDefault();
    setFormErr("");
    setShow(false);
    setConfirmSend(true);
  }

  // Step 2: confirmed, send it
  async function send() {
    setBusy(true);
    try {
      await api.post("/leaves", { fromDate: f.fromDate, toDate: f.toDate, reason: f.reason.trim() });
      setConfirmSend(false);
      toast("📨 Leave request sent.");
      await load();
    } catch (err) {
      setFormErr(errMsg(err)); // back to the form with the reason
      setConfirmSend(false);
      setShow(true);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.post(`/leaves/${cancelling._id}/cancel`);
      toast("Leave request cancelled.");
      setCancelling(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
      setCancelling(null);
    } finally {
      setBusy(false);
    }
  }

  const days = daysInclusive(f.fromDate, f.toDate);
  const latest = addDaysStr(todayStr(), 365);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">My leave</h2>
        <Button onClick={open}>➕ Apply for leave</Button>
      </div>

      <Alert>{error}</Alert>

      <Card>
        <div className="space-y-3">
          {(items || []).map((l) => (
            <div key={l._id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-brand-50 p-3 sm:p-4 dark:bg-slate-800">
              <div className="min-w-0">
                <div className="font-extrabold">
                  {fmtRange(l.fromDate, l.toDate)}{" "}
                  <span className="text-xs font-bold opacity-60">({daysInclusive(l.fromDate, l.toDate)} day{daysInclusive(l.fromDate, l.toDate) === 1 ? "" : "s"})</span>
                </div>
                <p className="mt-1 break-words text-sm opacity-80">{l.reason}</p>
                {l.decisionNote && <p className="mt-1 text-xs font-semibold italic opacity-70">“{l.decisionNote}” {l.decidedBy?.name ? `· ${l.decidedBy.name}` : ""}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={LEAVE_TONE[l.status]}>{l.status}</Badge>
                {l.status === "pending" && (
                  <Button variant="danger" className="!px-3 !py-1" onClick={() => setCancelling(l)}>Cancel</Button>
                )}
              </div>
            </div>
          ))}
          {items && !items.length && <p className="text-sm opacity-60">No leave requests yet.</p>}
          {!items && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}
        </div>
      </Card>

      {show && (
        <FormModal title="Apply for leave" onClose={() => setShow(false)}>
          <form className="space-y-3" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From *" type="date" required min={addDaysStr(todayStr(), -7)} max={latest} value={f.fromDate}
                onChange={(e) => setF({ ...f, fromDate: e.target.value, toDate: e.target.value > f.toDate ? e.target.value : f.toDate })} />
              <Field label="To *" type="date" required min={f.fromDate} max={latest} value={f.toDate}
                onChange={(e) => setF({ ...f, toDate: e.target.value })} />
            </div>
            <label className="block text-sm font-semibold">
              <span className="mb-1 block">Reason *</span>
              <textarea
                required
                rows={4}
                minLength={5}
                maxLength={500}
                value={f.reason}
                onChange={(e) => setF({ ...f, reason: e.target.value })}
                className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <Alert>{formErr}</Alert>
            <div className="flex gap-2">
              <Button>Continue</Button>
              <Button type="button" variant="soft" onClick={() => setShow(false)}>Cancel</Button>
            </div>
          </form>
        </FormModal>
      )}

      <ConfirmDialog
        open={confirmSend}
        icon="🌴"
        title="Send leave request?"
        message={`${fmtRange(f.fromDate, f.toDate)} (${days} day${days === 1 ? "" : "s"}) will be sent to ${approver}.`}
        confirmText="Yes, send"
        cancelText="Go back"
        confirmVariant="primary"
        busy={busy}
        busyText="Sending…"
        onConfirm={send}
        onCancel={() => { setConfirmSend(false); setShow(true); }}
      />

      <ConfirmDialog
        open={!!cancelling}
        icon="🌴"
        title="Cancel this request?"
        message="The request will be withdrawn."
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