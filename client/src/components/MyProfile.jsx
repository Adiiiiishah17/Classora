import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, Badge, Button, Card, Field } from "./ui";
import Avatar from "./Avatar";
import ConfirmDialog from "./ConfirmDialog";
import FormModal from "./FormModal";
import { resizeToSquareJpeg } from "../utils/image";
import { splitList } from "../utils/text";
import { fmtDate, todayStr } from "../utils/dates";
import { PHONE_HINT, cleanPhone, isValidEmail, isValidPhone } from "../utils/validators";

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-1 border-t border-brand-500/10 py-2 first:border-t-0">
      <span className="text-xs font-extrabold uppercase opacity-60">{label}</span>
      <span className="break-words text-right text-sm font-bold">{children || "—"}</span>
    </div>
  );
}

const badges = (list, tone) =>
  list?.length ? (
    <span className="flex flex-wrap justify-end gap-1">
      {list.map((x) => <Badge key={x} tone={tone}>{x}</Badge>)}
    </span>
  ) : null;

export default function MyProfile() {
  const { patchUser } = useAuth();
  const fileRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [removeAsk, setRemoveAsk] = useState(false);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({});
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/profile/me");
      setData(r.data);
      const u = r.data.user;
      // keeps the header (name, photo) in step with what was just saved
      patchUser({ name: u.name, email: u.email, username: u.username, hasPhoto: u.hasPhoto, photoV: u.photoV });
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [patchUser]);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <Alert>{error}</Alert> : <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>;

  const { user, profile, security } = data;
  const isStudent = user.role === "student";
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets you pick the same file again later
    if (!file) return;
    setError("");
    setNotice("");
    setPhotoBusy(true);
    try {
      const blob = await resizeToSquareJpeg(file);
      const fd = new FormData();
      fd.append("photo", blob, "photo.jpg");
      const r = await api.post("/profile/photo", fd);
      patchUser({ hasPhoto: true, photoV: r.data.photoV });
      setData((d) => ({ ...d, user: { ...d.user, hasPhoto: true, photoV: r.data.photoV } }));
      setNotice("✅ Your photo was updated.");
    } catch (err) {
      setError(err?.response ? errMsg(err) : err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await api.delete("/profile/photo");
      patchUser({ hasPhoto: false, photoV: 0 });
      setData((d) => ({ ...d, user: { ...d.user, hasPhoto: false, photoV: 0 } }));
      setNotice("Your photo was removed.");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPhotoBusy(false);
      setRemoveAsk(false);
    }
  }

  function openEdit() {
    const base = {
      name: user.name,
      username: user.username || "",
      email: user.email,
      phone: user.phone || "",
      dob: user.dob || "",
      currentPassword: "",
    };
    setForm(
      isStudent
        ? {
            ...base,
            className: profile.className || "",
            subjects: profile.subjects.join(", "),
            guardianName: profile.guardianName || "",
            guardianPhone: profile.guardianPhone || "",
          }
        : {
            ...base,
            classNames: profile.classNames.join(", "),
            subjects: profile.subjects.join(", "),
            bio: profile.bio || "",
          }
    );
    setFormErr("");
    setEdit(true);
  }

  async function save(e) {
    e.preventDefault();
    setFormErr("");
    const f = form;
    const name = f.name.trim();
    const username = f.username.trim().toLowerCase();
    const email = f.email.trim().toLowerCase();
    const subjects = splitList(f.subjects);

    if (!name) return setFormErr("Enter your name.");
    if (!username && user.username) return setFormErr("Your username cannot be empty.");
    if (username && !/^(?=.*[a-z])[a-z0-9._]{3,30}$/.test(username)) {
      return setFormErr("Username needs 3 to 30 characters with at least one letter (letters, numbers, dot, underscore).");
    }
    if (!isValidEmail(email)) return setFormErr("Enter a valid email address, like name@example.com.");
    if (!isValidPhone(f.phone)) return setFormErr(PHONE_HINT);
    if (f.dob && f.dob > todayStr()) return setFormErr("Date of birth cannot be in the future.");
    if (isStudent && f.guardianPhone && !isValidPhone(f.guardianPhone)) {
      return setFormErr("Guardian contact must be a valid 10-digit mobile number.");
    }
    if (!isStudent && !subjects.length) return setFormErr("Enter the subject you teach.");

    // Send only what really changed
    const body = {};
    if (name !== user.name) body.name = name;
    if (username && username !== (user.username || "")) body.username = username;
    if (email !== user.email) {
      if (!f.currentPassword) return setFormErr("Enter your current password to change your email.");
      body.email = email;
      body.currentPassword = f.currentPassword;
    }
    if (f.phone !== (user.phone || "")) body.phone = f.phone;
    if ((f.dob || "") !== (user.dob || "")) body.dob = f.dob || "";
    if (subjects.join(", ") !== profile.subjects.join(", ")) body.subjects = subjects;

    if (isStudent) {
      const cn = f.className.trim();
      if (cn !== (profile.className || "")) body.className = cn || null;
      if (f.guardianName.trim() !== (profile.guardianName || "")) body.guardianName = f.guardianName.trim();
      if (f.guardianPhone !== (profile.guardianPhone || "")) body.guardianPhone = f.guardianPhone;
    } else {
      const cls = splitList(f.classNames);
      if (cls.join(", ") !== profile.classNames.join(", ")) body.classNames = cls;
      if (f.bio.trim() !== (profile.bio || "")) body.bio = f.bio.trim();
    }

    if (!Object.keys(body).filter((k) => k !== "currentPassword").length) {
      setEdit(false);
      return setNotice("Nothing was changed.");
    }

    setSaving(true);
    try {
      await api.patch("/profile/me", body);
      setEdit(false);
      setNotice("✅ Your details were saved.");
      await load();
    } catch (err) {
      setFormErr(errMsg(err)); // shown inside the popup, your typing stays
    } finally {
      setSaving(false);
    }
  }

  const emailChanged = form.email && form.email.trim().toLowerCase() !== user.email;

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-extrabold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
          {notice}
        </div>
      )}
      <Alert>{error}</Alert>

      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar id={user.id} v={user.photoV} name={user.name} hasPhoto={user.hasPhoto} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-2xl font-extrabold">{user.name}</h2>
          <div className="mt-1"><Badge tone="violet">{user.role}</Badge></div>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
            <Button disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              {photoBusy ? "Working…" : user.hasPhoto ? "📷 Change photo" : "📷 Add photo"}
            </Button>
            {user.hasPhoto && (
              <Button variant="danger" disabled={photoBusy} onClick={() => setRemoveAsk(true)}>Remove photo</Button>
            )}
            <Button variant="soft" onClick={openEdit}>✏️ Edit details</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-lg font-extrabold">🙂 About you</h3>
          <Row label="Name">{user.name}</Row>
          <Row label="Username">{user.username ? `@${user.username}` : ""}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Mobile number">{user.phone}</Row>
          <Row label="Date of birth">{user.dob ? fmtDate(user.dob) : ""}</Row>
          {isStudent ? (
            <>
              <Row label="Guardian name">{profile.guardianName}</Row>
              <Row label="Guardian contact">{profile.guardianPhone}</Row>
            </>
          ) : (
            <div className="border-t border-brand-500/10 py-2">
              <span className="text-xs font-extrabold uppercase opacity-60">Bio (students can see this)</span>
              <p className="mt-1 whitespace-pre-line break-words text-sm font-semibold">
                {profile.bio || "You have not written a bio yet."}
              </p>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-1 text-lg font-extrabold">🏫 At school</h3>
          <p className="mb-2 text-xs font-semibold opacity-60">
            {isStudent ? "Your roll number is given by the school and changes when you change class." : "Your employee ID is given by the school."}
          </p>
          {isStudent ? (
            <>
              <Row label="Class">{profile.className}</Row>
              <Row label="Roll number">{profile.rollNumber}</Row>
              <Row label="Subjects">{badges(profile.subjects, "violet")}</Row>
            </>
          ) : (
            <>
              <Row label="Employee ID">{profile.employeeId}</Row>
              <Row label="Classes">{badges(profile.classNames, "violet")}</Row>
              <Row label="Subjects">{badges(profile.subjects, "green")}</Row>
            </>
          )}
        </Card>
      </div>

      {edit && (
        <FormModal title="Edit your details" onClose={() => !saving && setEdit(false)}>
          <form className="space-y-3" onSubmit={save}>
            <Field label="Name *" required maxLength={100} value={form.name || ""} onChange={set("name")} />
            <Field label="Username" maxLength={30} value={form.username || ""} onChange={set("username")} />
            <Field label="Email *" type="email" required value={form.email || ""} onChange={set("email")} />
            {emailChanged && (
              <div>
                <Field label="Current password (needed to change your email) *" type="password" required
                  autoComplete="current-password" value={form.currentPassword || ""} onChange={set("currentPassword")} />
                {!security.hasPassword && (
                  <p className="mt-1 text-xs font-bold text-rose-600 dark:text-rose-300">
                    You have no password yet, so your email cannot be changed. Use “Forgot password” first.
                  </p>
                )}
              </div>
            )}
            <Field label="Mobile number (10 digits) *" type="tel" inputMode="numeric" required maxLength={10}
              value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: cleanPhone(e.target.value) })} />
            <Field label="Date of birth" type="date" max={todayStr()} value={form.dob || ""} onChange={set("dob")} />

            {isStudent ? (
              <>
                <Field label="Class (leave empty for none)" maxLength={40} value={form.className || ""} onChange={set("className")} />
                <Field label="Subjects (comma separated)" placeholder="Maths, Physics" value={form.subjects || ""} onChange={set("subjects")} />
                <Field label="Guardian name" maxLength={100} value={form.guardianName || ""} onChange={set("guardianName")} />
                <Field label="Guardian contact (10 digits)" type="tel" inputMode="numeric" maxLength={10}
                  value={form.guardianPhone || ""} onChange={(e) => setForm({ ...form, guardianPhone: cleanPhone(e.target.value) })} />
              </>
            ) : (
              <>
                <Field label="Classes (comma separated)" placeholder="10, 9" value={form.classNames || ""} onChange={set("classNames")} />
                <Field label="Subjects * (comma separated)" required placeholder="Maths, Physics" value={form.subjects || ""} onChange={set("subjects")} />
                <label className="block text-sm font-semibold">
                  <span className="mb-1 block">Bio ({(form.bio || "").length}/500)</span>
                  <textarea
                    rows={5}
                    maxLength={500}
                    value={form.bio || ""}
                    onChange={set("bio")}
                    placeholder="A few lines about you and how you teach…"
                    className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
              </>
            )}

            <Alert>{formErr}</Alert>
            <div className="flex gap-2">
              <Button disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="soft" disabled={saving} onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </form>
        </FormModal>
      )}

      <ConfirmDialog
        open={removeAsk}
        icon="🖼️"
        title="Remove your photo?"
        message="Your initials will be shown instead. You can add a photo again any time."
        confirmText="Yes, remove"
        cancelText="Keep it"
        busy={photoBusy}
        busyText="Removing…"
        onConfirm={removePhoto}
        onCancel={() => setRemoveAsk(false)}
      />
    </div>
  );
}