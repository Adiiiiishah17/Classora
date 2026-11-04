import { useState } from "react";
import { api, errMsg } from "../api/client";
import { Alert, Button, Field, Modal } from "./ui";
import { splitList } from "../utils/text";

export default function EditProfileModal({ role, profile, act, onClose }) {
  const [cls, setCls] = useState(role === "student" ? profile.className || "" : (profile.classNames || []).join(", "));
  const [subjects, setSubjects] = useState((profile.subjects || []).join(", "));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setErr("");
    const subjectList = splitList(subjects);
    if (role === "teacher" && !subjectList.length) return setErr("A teacher needs at least one subject.");
    setBusy(true);
    try {
      await api.patch(
        `/admin/users/${profile.userId._id}/profile`,
        role === "student"
          ? { className: cls.trim() ? cls.trim() : null, subjects: subjectList }
          : { classNames: splitList(cls), subjects: subjectList }
      );
      await act(async () => {}); // refresh the lists
      onClose();
    } catch (error) {
      setErr(errMsg(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${profile.userId?.name || ""}`}>
      <form className="space-y-4" onSubmit={save}>
        {role === "student" ? (
          <Field label="Class (e.g. 10-A, leave empty for none)" maxLength={40} value={cls} onChange={(e) => setCls(e.target.value)} />
        ) : (
          <Field label="Classes (comma separated, e.g. 10-A, 9-B)" value={cls} onChange={(e) => setCls(e.target.value)} />
        )}
        <Field label={role === "teacher" ? "Subjects * (comma separated)" : "Subjects (comma separated)"}
          placeholder="Maths, Physics" value={subjects} onChange={(e) => setSubjects(e.target.value)} />

        <Alert>{err}</Alert>
        <div className="flex gap-2">
          <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          <Button type="button" variant="soft" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}