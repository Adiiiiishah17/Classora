import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, Field, Modal, cx } from "./ui";
import { LEAVE_TONE } from "../utils/status";
import { daysInclusive, fmtDateTime, fmtRange } from "../utils/dates";

const FILTERS = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]];

export default function LeaveInbox() {
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [target, setTarget] = useState(null); // { leave, decision }
  const [note, setNote] = useState("");
  const [modalErr, setModalErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/leaves/inbox", { params: { status } });
      setItems(r.data.items);
      setError("");
    } catch (e) {
      setItems([]);
      setError(errMsg(e));
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  useLive("leave:new", () => load());
  useLive("leave:handled", () => load());
  useLive("leave:cancelled", () => load());

  const open = (leave, decision) => { setTarget({ leave, decision }); setNote(""); setModalErr(""); };

  async function decide() {
    setBusy(true);
    setModalErr("");
    try {
      await api.post(`/leaves/${target.leave._id}/decision`, {
        decision: target.decision,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      const who = target.leave.applicantId?.name || "the applicant";
      toast(target.decision === "approve" ? `✅ Approved leave for ${who}` : `Rejected leave for ${who}`);
      setTarget(null);
      await load();
    } catch (e) {
      setModalErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const approving = target?.decision === "approve";

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
          {(items || []).map((l) => (
            <div key={l._id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-brand-50 p-3 sm:p-4 dark:bg-slate-800">
              <div className="min-w-0">
                <div className="font-extrabold">
                  {l.applicantRole === "student" ? "🎒" : "👩‍🏫"} {l.applicantId?.name || "Unknown"}{" "}
                  <Badge tone="violet">{l.applicantRole}</Badge>{" "}
                  {l.className && <Badge tone="violet">Class {l.className}</Badge>}
                </div>
                <div className="mt-1 text-sm font-bold">
                  {fmtRange(l.fromDate, l.toDate)}{" "}
                  <span className="text-xs opacity-60">({daysInclusive(l.fromDate, l.toDate)} day{daysInclusive(l.fromDate, l.toDate) === 1 ? "" : "s"})</span>
                </div>
                <p className="mt-1 break-words text-sm opacity-80">{l.reason}</p>
                <div className="mt-1 text-xs opacity-60">Sent {fmtDateTime(l.createdAt)}</div>
                {l.status !== "pending" && (
                  <div className="mt-1 text-xs font-semibold opacity-80">
                    {l.status} {l.decidedBy?.name ? `by ${l.decidedBy.name}` : ""}{l.decisionNote ? ` · “${l.decisionNote}”` : ""}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={LEAVE_TONE[l.status]}>{l.status}</Badge>
                {l.status === "pending" && (
                  <div className="flex gap-2">
                    <Button className="!px-3 !py-1.5" onClick={() => open(l, "approve")}>Approve</Button>
                    <Button variant="danger" className="!px-3 !py-1.5" onClick={() => open(l, "reject")}>Reject</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {items && !items.length && <p className="text-sm opacity-60">Nothing here. 🎉</p>}
          {!items && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}
        </div>
      </Card>

      <Modal open={!!target} onClose={() => !busy && setTarget(null)} title={approving ? "Approve this leave?" : "Reject this leave?"}>
        {target && (
          <div className="space-y-3 text-sm">
           <p className="font-semibold opacity-80">{target.leave.applicantId?.name}, {fmtRange(target.leave.fromDate, target.leave.toDate)}.</p>
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