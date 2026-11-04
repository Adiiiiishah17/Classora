import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, Field } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import FormModal from "./FormModal";
import { fmtDateTime } from "../utils/dates";

const AUDIENCE = {
  all: "Everyone",
  students: "All students",
  teachers: "All teachers",
  class: "One class",
};

const inputCls =
  "w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900";

export default function Announcements({ canPost = false, role = "student" }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { id?, title, body, urgent, audience, className }
  const [formErr, setFormErr] = useState("");
  const [classes, setClasses] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const audiences = role === "admin" ? ["all", "students", "teachers", "class"] : ["students", "class"];

  const load = useCallback(async () => {
    try {
      const r = await api.get("/announcements");
      setItems(r.data.items);
      setError("");
    } catch (e) {
      setItems([]);
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canPost) return;
    api.get("/attendance/classes").then((r) => setClasses(r.data.classes)).catch(() => {});
  }, [canPost]);

  useLive("announcement:changed", load);
  useLive("announcement:new", (p) => {
    if (p?.authorId !== user.id) toast(`📢 ${p?.title || "New announcement"}`);
  });

  const openNew = () => {
    setFormErr("");
    setForm({ title: "", body: "", urgent: false, audience: audiences[0], className: classes[0] || "" });
  };
  const openEdit = (a) => {
    setFormErr("");
    setForm({ id: a._id, title: a.title, body: a.body, urgent: !!a.urgent, audience: a.audience, className: a.className || "" });
  };

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setFormErr("");
    try {
      if (form.id) {
        await api.put(`/announcements/${form.id}`, { title: form.title.trim(), body: form.body.trim(), urgent: form.urgent });
        toast("Announcement updated.");
      } else {
        await api.post("/announcements", {
          title: form.title.trim(),
          body: form.body.trim(),
          urgent: form.urgent,
          audience: form.audience,
          ...(form.audience === "class" ? { className: form.className } : {}),
        });
        toast("📢 Announcement sent.");
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormErr(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/announcements/${deleting._id}`);
      toast("Announcement deleted.");
      setDeleting(null);
      await load();
    } catch (err) {
      setError(errMsg(err));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">Announcements</h2>
        {canPost && <Button onClick={openNew}>➕ New announcement</Button>}
      </div>

      <Alert>{error}</Alert>

      <div className="space-y-3">
        {(items || []).map((a) => (
          <Card key={a._id} className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-extrabold">
                  {a.urgent && <span className="mr-1">❗</span>}{a.title}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs font-bold opacity-80">
                  <Badge tone="violet">{a.audience === "class" ? `Class ${a.className}` : AUDIENCE[a.audience]}</Badge>
                  <span>by {a.authorName || "School"} · {fmtDateTime(a.createdAt)}</span>
                </div>
              </div>
              {canPost && (a.mine || role === "admin") && (
                <div className="flex gap-2">
                  <Button variant="soft" className="!px-3 !py-1.5" onClick={() => openEdit(a)}>Edit</Button>
                  <Button variant="danger" className="!px-3 !py-1.5" onClick={() => setDeleting(a)}>Delete</Button>
                </div>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm opacity-90">{a.body}</p>
          </Card>
        ))}
        {items && !items.length && <Card><p className="text-sm opacity-60">No announcements yet.</p></Card>}
        {!items && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}
      </div>

      {form && (
        <FormModal title={form.id ? "Edit announcement" : "New announcement"} onClose={() => setForm(null)}>
          <form className="space-y-3" onSubmit={save}>
            {!form.id && (
              <>
                <label className="block text-sm font-semibold">
                  <span className="mb-1 block">Send to *</span>
                  <select className={inputCls} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                    {audiences.map((k) => <option key={k} value={k}>{AUDIENCE[k]}</option>)}
                  </select>
                </label>
                {form.audience === "class" && (
                  <label className="block text-sm font-semibold">
                    <span className="mb-1 block">Class *</span>
                    <select required className={inputCls} value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })}>
                      <option value="" disabled>Choose a class</option>
                      {classes.map((c) => <option key={c} value={c}>Class {c}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
            <Field label="Title *" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label className="block text-sm font-semibold">
              <span className="mb-1 block">Message *</span>
              <textarea required rows={5} maxLength={2000} className={inputCls} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} />
              Urgent (also sent by email)
            </label>
            <Alert>{formErr}</Alert>
            <div className="flex gap-2">
              <Button disabled={busy}>{busy ? "Saving…" : form.id ? "Save" : "Send"}</Button>
              <Button type="button" variant="soft" onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </FormModal>
      )}

      <ConfirmDialog
        open={!!deleting}
        icon="📢"
        title="Delete this announcement?"
        message={deleting ? `"${deleting.title}" will be removed for everyone.` : ""}
        confirmText="Yes, delete"
        cancelText="Keep it"
        busy={busy}
        busyText="Deleting…"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}