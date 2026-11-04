import { useState } from "react";
import { api } from "../../api/client";
import { Badge, Button, Card } from "../../components/ui";
import ConfirmDialog from "../../components/ConfirmDialog";

export default function RequestsTab({ data, act, notify }) {
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    const ok = await act(async () => {
      await api.post(`/admin/requests/${approving._id}/approve`);
    });
    if (ok) notify(`✅ ${approving.name} was approved and can sign in now.`);
    setBusy(false);
    setApproving(null);
  }

  async function reject() {
    setBusy(true);
    const ok = await act(async () => {
      await api.post(`/admin/requests/${rejecting._id}/reject`);
    });
    if (ok) notify(`Request from ${rejecting.name} was rejected.`);
    setBusy(false);
    setRejecting(null);
  }

  const approveText = approving
    ? `${approving.name} will be added as a ${approving.role}${approving.className ? ` in class ${approving.className}` : ""}. They can sign in right away with the password they chose.`
    : "";

  return (
    <Card>
      <h2 className="mb-4 text-lg font-extrabold">Account requests</h2>
      <div className="space-y-3">
        {data.requests.map((r) => (
          <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4 dark:bg-slate-800">
            <div className="min-w-0">
              <div className="font-extrabold">
                {r.role === "student" ? "🎒" : "👩‍🏫"} {r.name} <Badge tone="violet">{r.role}</Badge>
              </div>
              <div className="text-xs opacity-70">
                {r.email}{r.username ? ` · @${r.username}` : ""}{r.phone ? ` · 📱 ${r.phone}` : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.className && <Badge tone="violet">Class {r.className}</Badge>}
                {r.classNames?.map((c) => <Badge key={c} tone="violet">Class {c}</Badge>)}
                {r.subjects?.map((s) => <Badge key={s} tone="green">📚 {s}</Badge>)}
              </div>
              {r.message && <div className="mt-1 text-xs font-semibold italic opacity-80">“{r.message}”</div>}
              <div className="mt-1 text-xs opacity-50">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <Button className="!px-4 !py-1.5" onClick={() => setApproving(r)}>Approve</Button>
              <Button variant="danger" className="!px-4 !py-1.5" onClick={() => setRejecting(r)}>Reject</Button>
            </div>
          </div>
        ))}
        {!data.requests.length && <p className="text-sm opacity-60">No pending requests 🎉</p>}
      </div>

      <ConfirmDialog
        open={!!approving}
        icon="✅"
        title="Approve this request?"
        message={approveText}
        confirmText="Yes, approve"
        cancelText="Not yet"
        confirmVariant="primary"
        busy={busy}
        busyText="Approving…"
        onConfirm={approve}
        onCancel={() => setApproving(null)}
      />

      <ConfirmDialog
        open={!!rejecting}
        icon="🗑️"
        title="Reject this request?"
        message={rejecting ? `${rejecting.name} will not get an account. They can send a new request later.` : ""}
        confirmText="Yes, reject"
        cancelText="Keep it"
        busy={busy}
        busyText="Rejecting…"
        onConfirm={reject}
        onCancel={() => setRejecting(null)}
      />
    </Card>
  );
}