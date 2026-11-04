import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../../api/client";
import { Alert, Badge, Button, Card, Field, Modal, SectionHeading, cx } from "../../components/ui";
import LoginCodeModal from "../../components/LoginCodeModal";
import LoginCredentialsModal from "../../components/LoginCredentialsModal";
import ChangePasswordCard from "../../components/ChangePasswordCard";
import EditProfileModal from "../../components/EditProfileModal";
import RequestsTab from "./RequestsTab";
import GroupsTab from "./GroupsTab";
import ActivityTab from "./ActivityTab";
import AttendanceTab from "./AttendanceTab";
import LeaveInbox from "../../components/LeaveInbox";
import { useLive } from "../../context/SocketContext";
import { splitList } from "../../utils/text";
import AttendanceRequestPopup from "../../components/AttendanceRequestPopup";
import { PHONE_HINT, cleanPhone, isValidEmail, isValidPhone } from "../../utils/validators";
import NotificationBell from "../../components/NotificationBell";
import Announcements from "../../components/Announcements";
import Documents from "../../components/Documents";
import ProfileViewModal from "../../components/ProfileViewModal"; // NEW
import Avatar from "../../components/Avatar";
import { todayStr } from "../../utils/dates";
import { GraduationCap, Inbox, Plus, School, Users, X } from "lucide-react";
import { useTab } from "../../utils/useTab";
import { useNav } from "../../context/NavContext";
import { labelFor } from "../../utils/nav";

// A Field with a red message underneath
function F({ error, ...p }) {
  return (
    <div>
      <Field {...p} />
      {error && <p className="mt-1 text-xs font-bold text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  );
}

const emailError = (v) => (v && !isValidEmail(v) ? "Enter a valid email, like name@example.com" : "");
const phoneError = (v) =>
  v && v.length < 10 ? `${10 - v.length} more digit${10 - v.length === 1 ? "" : "s"} needed`
  : v && !isValidPhone(v) ? PHONE_HINT : "";

// A popup for the "Add ..." forms. Clicking outside does NOT close it, so typing is never lost by accident.
function FormModal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4">
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop-in max-h-[92dvh] w-full max-w-lg overflow-y-auto !rounded-b-none sm:!rounded-b-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="bouncy rounded-full bg-brand-100 px-3 py-1 text-sm font-extrabold text-brand-700 dark:bg-slate-800 dark:text-brand-200"
          >
            ✕
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function TabHeader({ title, hint, buttonText, onAdd }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-extrabold">{title}</h2>
        {hint && <p className="text-xs font-semibold opacity-70">{hint}</p>}
      </div>
      <Button onClick={onAdd}>{buttonText}</Button>
    </div>
  );
}
export default function AdminDashboard() {
  const [tab, setTab] = useTab("admin");
  const { setBadges } = useNav();
  const [data, setData] = useState({ students: [], teachers: [], requests: [], batches: [], classGroups: [], leaves: [] });
  const [secret, setSecret] = useState(null);
  const [codeInfo, setCodeInfo] = useState(null);
  const [showClass, setShowClass] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const notify = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 6000);
  };

  // Each list loads on its own, so one failing request no longer empties the others
  const load = useCallback(async () => {
    const calls = [
      ["students", api.get("/admin/students"), (r) => r.data.students],
      ["teachers", api.get("/admin/teachers"), (r) => r.data.teachers],
      ["requests", api.get("/admin/requests"), (r) => r.data.requests],
      ["batches", api.get("/admin/batches"), (r) => r.data.batches],
      ["classGroups", api.get("/admin/class-groups"), (r) => r.data.groups],
      ["leaves", api.get("/leaves/inbox", { params: { status: "pending" } }), (r) => r.data.items],
    ];
    const results = await Promise.allSettled(calls.map(([, p]) => p));
    const next = {};
    const failed = [];
    results.forEach((res, i) => {
      const [key, , pick] = calls[i];
      if (res.status === "fulfilled") next[key] = pick(res.value);
      else failed.push(`${key} (${errMsg(res.reason)})`);
    });
    setData((d) => ({ ...d, ...next }));
    setError(failed.length ? `Could not load: ${failed.join(", ")}` : "");
  }, []);
  useEffect(() => { load(); }, [load]);

  // Live: the admin hears about new requests the moment they happen
  useLive("request:new", () => { notify("A new account request just arrived."); load(); });
  useLive("leave:new", () => { notify("A new leave request just arrived."); load(); });
  useLive("leave:handled", () => load());

  // Runs an action, refreshes the lists, returns true on success
  const act = async (fn) => {
    setError("");
    try { await fn(); await load(); return true; }
    catch (e) {
      setError(errMsg(e));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
  };

  const pending = data.requests.length;
  const pendingLeaves = data.leaves.length;

  // Counts shown next to "Requests" and "Leaves" in the sidebar
  useEffect(() => {
    setBadges({ requests: pending, leaves: pendingLeaves });
  }, [pending, pendingLeaves, setBadges]);

   const stats = [
    ["🏫", "Classes", data.classGroups.length],
    ["🎒", "Students", data.students.length],
    ["👩‍🏫", "Teachers", data.teachers.length],
    ["📨", "Pending requests", pending],
  ];
  const props = { data, act, reload: load, setSecret, setCodeInfo, notify };

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Admin" title={labelFor("admin", tab)} />

         {tab === "overview" && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map(([icon, label, n]) => (
            <Card key={label} className="bouncy flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
              <div className="text-3xl sm:text-4xl">{icon}</div>
              <div>
                <div className="text-2xl font-extrabold sm:text-3xl">{n}</div>
                <div className="text-xs font-bold opacity-70 sm:text-sm">{label}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AttendanceRequestPopup />

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {pending > 0 && tab !== "requests" && (
        <button
          onClick={() => setTab("requests")}
          className="flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <Inbox size={18} className="shrink-0" />
          {pending} new account {pending === 1 ? "request is" : "requests are"} waiting for you. Click to review.
        </button>
      )}

      <Alert>{error}</Alert>

      {tab === "students" && <StudentsTab {...props} />}
      {tab === "teachers" && <TeachersTab {...props} />}
      {tab === "classes" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button className="inline-flex items-center gap-1.5" onClick={() => setShowClass(true)}>
              <Plus size={16} /> Add class
            </Button>
          </div>
          <GroupsTab kind="class" data={data} />
        </div>
      )}
      {tab === "batches" && <GroupsTab kind="batch" data={data} />}
      {tab === "attendance" && <AttendanceTab />}
      {tab === "leaves" && <LeaveInbox />}
      {tab === "documents" && <Documents canPost role="admin" />}
      {tab === "announcements" && <Announcements canPost role="admin" />}
      {tab === "requests" && <RequestsTab {...props} />}
      {tab === "activity" && <ActivityTab />}
      {tab === "security" && (
        <div className="max-w-xl"><ChangePasswordCard hasPassword /></div>
      )}

      {showClass && (
        <AddClassModal
          onClose={() => setShowClass(false)}
          onDone={async (name) => {
            setShowClass(false);
            notify(`Class ${name} was added.`);
            await load();
          }}
        />
      )}

      <Modal open={!!secret} onClose={() => setSecret(null)} title="Temporary password">
        {secret && (
          <div className="space-y-3 text-sm">
            <p><b>{secret.name || secret.email}</b> must change this password at first login.</p>
            <div className="break-all rounded-lg bg-brand-50 p-4 font-mono text-base font-bold dark:bg-slate-800">{secret.tempPassword}</div>
            <p className="font-semibold text-rose-600 dark:text-rose-300">Shown only once. Copy it now and share it privately.</p>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => navigator.clipboard.writeText(secret.tempPassword)}>Copy</Button>
              <Button onClick={() => setSecret(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      <LoginCodeModal info={codeInfo} onClose={() => setCodeInfo(null)} />
    </div>
  );
}

function AddClassModal({ onClose, onDone }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.post("/admin/class-groups", { name: name.trim() });
      await onDone(name.trim()); // closes this popup
    } catch (error) {
      setErr(errMsg(error));
      setBusy(false);
    }
  }

  return (
    <FormModal title="Add class" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <F label="Class name *" required autoFocus maxLength={20} placeholder="10" value={name} onChange={(e) => setName(e.target.value)} />
        <Alert>{err}</Alert>
        <div className="flex gap-2">
          <Button disabled={busy}>{busy ? "Adding…" : "Add class"}</Button>
          <Button type="button" variant="soft" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </FormModal>
  );
}

function UserActions({ u, act, setSecret, setCodeInfo, extra }) {
  const [creds, setCreds] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      {extra}
      <Button variant={u.isActive ? "danger" : "soft"} className="!px-3 !py-1.5"
        onClick={() => act(() => api.patch(`/admin/users/${u._id}/active`, { isActive: !u.isActive }))}>
        {u.isActive ? "Disable" : "Enable"}
      </Button>
      <Button variant="soft" className="!px-3 !py-1.5" onClick={() => setCreds(true)}>🔑 Login credentials</Button>

      {creds && (
        <LoginCredentialsModal u={u} act={act} setSecret={setSecret} setCodeInfo={setCodeInfo} onClose={() => setCreds(false)} />
      )}
    </div>
  );
}

function StudentsTab({ data, reload, setSecret, setCodeInfo, act }) {
  const empty = { name: "", email: "", username: "", phone: "", dob: "", className: "", rollNumber: "", subjects: "", guardianName: "", guardianPhone: "" };
  const [f, setF] = useState(empty);
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null); // NEW: the id of the student whose profile is open
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const close = () => { setShow(false); setF(empty); setLocalError(""); };

  const submit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (!isValidEmail(f.email)) return setLocalError("Enter a valid email address, like name@example.com.");
    if (!isValidPhone(f.phone)) return setLocalError(PHONE_HINT);
    if (f.guardianPhone && !isValidPhone(f.guardianPhone)) {
      return setLocalError("Guardian contact must be a valid 10-digit mobile number.");
    }
    const subjects = splitList(f.subjects);
    const body = {
      name: f.name.trim(),
      email: f.email.trim(),
      username: f.username.trim(),
     phone: f.phone,
      ...(f.dob ? { dob: f.dob } : {}),
      ...(f.className.trim() ? { className: f.className.trim() } : {}),
      ...(f.className.trim() && f.rollNumber.trim() ? { rollNumber: f.rollNumber.trim() } : {}),
      ...(subjects.length ? { subjects } : {}),
      ...(f.guardianName.trim() ? { guardianName: f.guardianName.trim() } : {}),
      ...(f.guardianPhone ? { guardianPhone: f.guardianPhone } : {}),
    };

    setBusy(true);
    try {
      const r = await api.post("/admin/students", body);
      setSecret({ ...r.data.user, tempPassword: r.data.tempPassword });
      close();
      await reload();
    } catch (err) {
      setLocalError(errMsg(err)); // shown inside the popup
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <TabHeader
        title="Students"
        hint={`${data.students.length} in total`}
        buttonText="➕ Add student"
        onAdd={() => setShow(true)}
      />

      <Card className="min-w-0">
        <div className="space-y-3">
                   {data.students.map((s) => (
            <div key={s._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3 sm:p-4 dark:bg-slate-800">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar id={s.userId?._id} v={s.userId?.photoV} name={s.userId?.name} hasPhoto={!!s.userId?.hasPhoto} size="md" />
                <div className="min-w-0">
                  <div className="font-extrabold">
                    {s.userId?.name}
                    {s.rollNumber && <span className="text-xs font-bold opacity-60"> #{s.rollNumber}</span>}
                  </div>
                  <div className="break-words text-xs opacity-70">
                    {s.userId?.email}{s.userId?.username ? ` · @${s.userId.username}` : ""}
                    {s.userId?.phone ? ` · 📱 ${s.userId.phone}` : ""}
                    {s.className ? ` · Class ${s.className}` : " · No class yet"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={s.userId?.isActive ? "green" : "red"}>{s.userId?.isActive ? "Active" : "Disabled"}</Badge>
                    {s.userId?.loginCodeCreatedAt && <Badge tone="violet">🎟️ Code active</Badge>}
                    {s.subjects?.map((x) => <Badge key={x} tone="violet">📚 {x}</Badge>)}
                  </div>
                </div>
              </div>
              {s.userId && (
                <UserActions u={s.userId} act={act} setSecret={setSecret} setCodeInfo={setCodeInfo}
                  extra={
                    <>
                      <Button className="!px-3 !py-1.5" onClick={() => setViewing(s.userId._id)}>👤 View profile</Button>
                      <Button variant="soft" className="!px-3 !py-1.5" onClick={() => setEditing(s)}>✏️ Class & subjects</Button>
                    </>
                  } />
              )}
            </div>
          ))}
          {!data.students.length && (
            <p className="text-sm opacity-60">No students yet. Click “Add student” to create the first one.</p>
          )}
        </div>
      </Card>

      {show && (
        <FormModal title="Add student" onClose={close}>
          <form className="space-y-3" onSubmit={submit}>
            <F label="Full name *" required value={f.name} onChange={set("name")} />
            <F label="Email *" type="email" required value={f.email} onChange={set("email")} error={emailError(f.email)} />
            <F label="Username *" required value={f.username} onChange={set("username")} />
            <F label="Personal mobile number (10 digits) *" type="tel" inputMode="numeric" required maxLength={10}
              placeholder="9876543210" value={f.phone}
              onChange={(e) => setF({ ...f, phone: cleanPhone(e.target.value) })} error={phoneError(f.phone)} />
                          <F label="Date of birth (optional)" type="date" max={todayStr()} value={f.dob} onChange={set("dob")} />
            <F label="Class (optional) " maxLength={40} value={f.className} onChange={set("className")} />
            {f.className.trim() && (
              <F label="Roll number (leave empty for automatic)" value={f.rollNumber} onChange={set("rollNumber")} />
            )}
            <F label="Subjects (optional, comma separated)" placeholder="Maths, Physics" value={f.subjects} onChange={set("subjects")} />
            <F label="Guardian name (optional)" value={f.guardianName} onChange={set("guardianName")} />
            <F label="Guardian contact (optional, 10 digits)" type="tel" inputMode="numeric" maxLength={10}
              value={f.guardianPhone} onChange={(e) => setF({ ...f, guardianPhone: cleanPhone(e.target.value) })}
              error={phoneError(f.guardianPhone)} />
            <Alert>{localError}</Alert>
            <div className="flex gap-2">
              <Button disabled={busy}>{busy ? "Creating…" : "Create student"}</Button>
              <Button type="button" variant="soft" onClick={close}>Cancel</Button>
            </div>
          </form>
        </FormModal>
      )}

      {editing && <EditProfileModal role="student" profile={editing} act={act} onClose={() => setEditing(null)} />}
      {viewing && <ProfileViewModal userId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function TeachersTab({ data, reload, setSecret, setCodeInfo, act }) {
  const empty = { name: "", email: "", username: "", phone: "", dob: "", employeeId: "", subjects: "", classNames: "" };
  const [f, setF] = useState(empty);
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null); // NEW: the id of the teacher whose profile is open
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const close = () => { setShow(false); setF(empty); setLocalError(""); };

  const submit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (!isValidEmail(f.email)) return setLocalError("Enter a valid email address, like name@example.com.");
    if (!isValidPhone(f.phone)) return setLocalError(PHONE_HINT);
    const subjects = splitList(f.subjects);
    if (!subjects.length) return setLocalError("Enter the subject this teacher teaches.");
    const body = {
      name: f.name.trim(),
      email: f.email.trim(),
      username: f.username.trim(),
            phone: f.phone,
      ...(f.dob ? { dob: f.dob } : {}),
      subjects,
      ...(splitList(f.classNames).length ? { classNames: splitList(f.classNames) } : {}),
      ...(f.employeeId.trim() ? { employeeId: f.employeeId.trim() } : {}),
    };

    setBusy(true);
    try {
      const r = await api.post("/admin/teachers", body);
      setSecret({ ...r.data.user, tempPassword: r.data.tempPassword });
      close();
      await reload();
    } catch (err) {
      setLocalError(errMsg(err)); // shown inside the popup
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <TabHeader
        title="Teachers"
        hint={`${data.teachers.length} in total`}
        buttonText="➕ Add teacher"
        onAdd={() => setShow(true)}
      />

      <Card className="min-w-0">
        <div className="space-y-3">
                    {data.teachers.map((t) => (
            <div key={t._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3 sm:p-4 dark:bg-slate-800">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar id={t.userId?._id} v={t.userId?.photoV} name={t.userId?.name} hasPhoto={!!t.userId?.hasPhoto} size="md" />
                <div className="min-w-0">
                  <div className="font-extrabold">{t.userId?.name}</div>
                  <div className="break-words text-xs opacity-70">
                    {t.userId?.email}{t.userId?.username ? ` · @${t.userId.username}` : ""}
                    {t.userId?.phone ? ` · 📱 ${t.userId.phone}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={t.userId?.isActive ? "green" : "red"}>{t.userId?.isActive ? "Active" : "Disabled"}</Badge>
                    {t.userId?.loginCodeCreatedAt && <Badge tone="violet">🎟️ Code active</Badge>}
                    {t.classNames?.map((c) => <Badge key={c} tone="violet">Class {c}</Badge>)}
                    {t.subjects?.map((s) => <Badge key={s} tone="green">📚 {s}</Badge>)}
                  </div>
                </div>
              </div>
              {t.userId && (
                <UserActions u={t.userId} act={act} setSecret={setSecret} setCodeInfo={setCodeInfo}
                  extra={
                    <>
                      <Button className="!px-3 !py-1.5" onClick={() => setViewing(t.userId._id)}>👤 View profile</Button>
                      <Button variant="soft" className="!px-3 !py-1.5" onClick={() => setEditing(t)}>✏️ Classes & subjects</Button>
                    </>
                  } />
              )}
            </div>
          ))}
          {!data.teachers.length && (
            <p className="text-sm opacity-60">No teachers yet. Click “Add teacher” to create the first one.</p>
          )}
        </div>
      </Card>

      {show && (
        <FormModal title="Add teacher" onClose={close}>
          <form className="space-y-3" onSubmit={submit}>
            <F label="Full name *" required value={f.name} onChange={set("name")} />
            <F label="Email *" type="email" required value={f.email} onChange={set("email")} error={emailError(f.email)} />
            <F label="Username *" required value={f.username} onChange={set("username")} />
            <F label="Personal mobile number (10 digits) *" type="tel" inputMode="numeric" required maxLength={10}
              placeholder="9876543210" value={f.phone}
              onChange={(e) => setF({ ...f, phone: cleanPhone(e.target.value) })} error={phoneError(f.phone)} />
                          <F label="Date of birth (optional)" type="date" max={todayStr()} value={f.dob} onChange={set("dob")} />
            <F label="Employee ID (optional)" value={f.employeeId} onChange={set("employeeId")} />
            <F label="Subject(s) * (comma separated)" required placeholder="Maths, Physics" value={f.subjects} onChange={set("subjects")} />
            <F label="Class(es) (optional, comma separated)" placeholder="10, 9" value={f.classNames} onChange={set("classNames")} />
            <Alert>{localError}</Alert>
            <div className="flex gap-2">
              <Button disabled={busy}>{busy ? "Creating…" : "Create teacher"}</Button>
              <Button type="button" variant="soft" onClick={close}>Cancel</Button>
            </div>
          </form>
        </FormModal>
      )}

      {editing && <EditProfileModal role="teacher" profile={editing} act={act} onClose={() => setEditing(null)} />}
      {viewing && <ProfileViewModal userId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}