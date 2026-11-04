import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Field, Modal, cx } from "./ui";
import { ATT } from "../utils/status";
import { fmtDate, fmtDateTime } from "../utils/dates";

// Shown to the admin whenever a teacher's attendance request is waiting
export default function AttendanceRequestPopup() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const current = items.find((i) => !dismissed.includes(i._id));

  const load = useCallback(async () => {
    try {
      const r = await api.get("/attendance/requests/inbox", { params: { status: "pending" } });
      setItems(r.data.items);
    } catch {
      /* the Teacher requests tab shows errors; the popup stays quiet */
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useLive("attreq:new", load);
  useLive("attreq:handled", load);

  const reset = () => { setRejecting(false); setNote(""); setErr(""); };
  const later = () => { if (current) setDismissed((d) => [...d, current._id]); reset(); };

  async function decide(decision) {
    setBusy(true);
    setErr("");
    try {
      await api.post(`/attendance/requests/${current._id}/decision`, {
        decision,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast(decision === "approve" ? `✅ ${current.teacherId?.name} is now marked present` : "Request rejected");
      reset();
      await load();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!current} onClose={() => !busy && later()} title="Attendance request">
      {current && (
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-extrabold">👩‍🏫 {current.teacherId?.name} <span className="text-xs font-bold opacity-60">@{current.teacherId?.username}</span></div>
            <div className="mt-1 flex flex-wrap items-center gap-2 font-bold">
              {fmtDate(current.date)}
              {current.current
                ? <span className={cx("rounded-full px-2 py-0.5 text-xs", ATT[current.current].cell)}>Now: {ATT[current.current].label}</span>
                : <Badge tone="amber">Not marked</Badge>}
            </div>
            <p className="mt-2 break-words opacity-80">{current.note}</p>
            <div className="mt-1 text-xs opacity-60">Sent {fmtDateTime(current.createdAt)}</div>
          </div>

          {rejecting && (
            <Field label="Reason for rejecting *" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
          <Alert>{err}</Alert>

          <div className="flex flex-wrap gap-2">
            {!rejecting ? (
              <>
                <Button disabled={busy} onClick={() => decide("approve")}>{busy ? "Saving…" : "Approve"}</Button>
                <Button variant="danger" disabled={busy} onClick={() => setRejecting(true)}>Reject</Button>
              </>
            ) : (
              <>
                <Button variant="danger" disabled={busy || !note.trim()} onClick={() => decide("reject")}>
                  {busy ? "Saving…" : "Confirm reject"}
                </Button>
                <Button variant="soft" disabled={busy} onClick={() => setRejecting(false)}>Back</Button>
              </>
            )}
            <Button variant="soft" disabled={busy} onClick={later}>Later</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}   