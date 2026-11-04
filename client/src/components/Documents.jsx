import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, Field } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import FormModal from "./FormModal";
import { fmtDateTime } from "../utils/dates";

const MAX_MB = 10; // the server enforces the real limit (MAX_UPLOAD_MB)
const AUDIENCE = { all: "Everyone", students: "All students", teachers: "All teachers", class: "One class" };

const ALLOWED = ["pdf", "txt", "csv", "docx", "pptx", "jpg", "jpeg", "png", "svg"];
const ACCEPT = ".pdf,.txt,.csv,.docx,.pptx,.jpg,.jpeg,.png,.svg";
const ICON = { pdf: "📄", txt: "📝", csv: "📊", docx: "📘", pptx: "📙", jpg: "🖼️", png: "🖼️", svg: "🖼️" };
const VIEWABLE = new Set(["pdf", "txt", "csv", "jpg", "png", "svg"]); // the others can only be downloaded

const inputCls =
  "w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900";
const linkCls = "bouncy rounded-full px-3 py-1.5 text-xs font-extrabold";

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const extOf = (name) => (/\.([A-Za-z0-9]{1,5})$/.exec(name || "")?.[1] || "").toLowerCase();

export default function Documents({ canPost = false, role = "student" }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // null | { title, audience, className, file }
  const [formErr, setFormErr] = useState("");
  const [classes, setClasses] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  const audiences = role === "admin" ? ["all", "students", "teachers", "class"] : ["students", "class"];

  const load = useCallback(async () => {
    try {
      const r = await api.get("/documents");
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

  useLive("document:changed", load);
  useLive("document:new", (p) => {
    if (p?.authorId !== user.id) toast(`📄 ${p?.title || "New file"}`);
  });

  const openNew = () => {
    setFormErr("");
    setPct(0);
    setForm({ title: "", audience: audiences[0], className: classes[0] || "", file: null });
  };

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return setForm({ ...form, file: null });
    if (!ALLOWED.includes(extOf(f.name))) {
      e.target.value = "";
      setFormErr("This file type is not allowed. You can upload PDF, TXT, DOCX, PPTX, CSV, JPG, PNG or SVG.");
      return setForm({ ...form, file: null });
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      e.target.value = "";
      setFormErr(`The file is too large. The limit is ${MAX_MB} MB.`);
      return setForm({ ...form, file: null });
    }
    setFormErr("");
    setForm({ ...form, file: f, title: form.title || f.name.replace(/\.[A-Za-z0-9]{1,5}$/, "") });
  }

  async function upload(e) {
    e.preventDefault();
    if (!form.file) return setFormErr("Choose a file.");
    setBusy(true);
    setFormErr("");
    setPct(0);
    try {
      const fd = new FormData();
      fd.append("title", form.title.trim());
      fd.append("audience", form.audience);
      if (form.audience === "class") fd.append("className", form.className);
      fd.append("file", form.file); // the file goes last
      await api.post("/documents", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 0, // a big file on a slow connection may take a while
        onUploadProgress: (ev) => ev.total && setPct(Math.round((ev.loaded * 100) / ev.total)),
      });
      toast("📄 File shared.");
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
      await api.delete(`/documents/${deleting._id}`);
      toast("File deleted.");
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
        <h2 className="text-xl font-extrabold">DPP / Files</h2>
        {canPost && <Button onClick={openNew}>➕ Upload file</Button>}
      </div>

      <Alert>{error}</Alert>

      <div className="space-y-3">
        {(items || []).map((d) => {
          const ext = d.ext || "pdf";
          return (
            <Card key={d._id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-lg font-extrabold">{ICON[ext] || "📄"} {d.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs font-bold opacity-80">
                  <Badge tone="violet">{d.audience === "class" ? `Class ${d.className}` : AUDIENCE[d.audience]}</Badge>
                  <Badge tone="gray">{ext.toUpperCase()}</Badge>
                  <span>{fmtSize(d.size)} · by {d.authorName || "School"} · {fmtDateTime(d.createdAt)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {VIEWABLE.has(ext) && (
                  <a href={`/api/documents/${d._id}/file`} target="_blank" rel="noopener noreferrer"
                    className={`${linkCls} bg-brand-500 text-white`}>Open</a>
                )}
                <a href={`/api/documents/${d._id}/file?download=1`}
                  className={`${linkCls} bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-brand-200`}>Download</a>
                {canPost && (d.mine || role === "admin") && (
                  <Button variant="danger" className="!px-3 !py-1.5" onClick={() => setDeleting(d)}>Delete</Button>
                )}
              </div>
            </Card>
          );
        })}
        {items && !items.length && <Card><p className="text-sm opacity-60">No files yet.</p></Card>}
        {!items && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}
      </div>

      {form && (
        <FormModal title="Upload file" onClose={() => !busy && setForm(null)}>
          <form className="space-y-3" onSubmit={upload}>
            <label className="block text-sm font-semibold">
              <span className="mb-1 block">Send to *</span>
              <select className={inputCls} value={form.audience} disabled={busy}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                {audiences.map((k) => <option key={k} value={k}>{AUDIENCE[k]}</option>)}
              </select>
            </label>
            {form.audience === "class" && (
              <label className="block text-sm font-semibold">
                <span className="mb-1 block">Class *</span>
                <select required className={inputCls} value={form.className} disabled={busy}
                  onChange={(e) => setForm({ ...form, className: e.target.value })}>
                  <option value="" disabled>Choose a class</option>
                  {classes.map((c) => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </label>
            )}
            <label className="block text-sm font-semibold">
              <span className="mb-1 block">File * (up to {MAX_MB} MB)</span>
              <input type="file" accept={ACCEPT} required disabled={busy} onChange={pickFile} className={inputCls} />
              <span className="mt-1 block text-xs font-semibold opacity-60">PDF, TXT, DOCX, PPTX, CSV, JPG, PNG or SVG</span>
            </label>
            <Field label="Title *" required maxLength={120} disabled={busy} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {busy && (
              <div className="h-2 overflow-hidden rounded-full bg-brand-100 dark:bg-slate-800">
                <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            <Alert>{formErr}</Alert>
            <div className="flex gap-2">
              <Button disabled={busy || !form.file}>{busy ? `Uploading ${pct}%` : "Upload"}</Button>
              <Button type="button" variant="soft" disabled={busy} onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </form>
        </FormModal>
      )}

      <ConfirmDialog
        open={!!deleting}
        icon="📄"
        title="Delete this file?"
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