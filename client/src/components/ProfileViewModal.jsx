import { useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { Alert, Badge, Button, Modal } from "./ui";
import Avatar from "./Avatar";
import { fmtDate } from "../utils/dates";

const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

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

export default function ProfileViewModal({ userId, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    api.get(`/profile/admin/${userId}`)
      .then((r) => { if (!off) setD(r.data); })
      .catch((e) => { if (!off) setErr(errMsg(e)); });
    return () => { off = true; };
  }, [userId]);

  const isStudent = d?.user.role === "student";

  return (
    <Modal open onClose={onClose} title="Profile (read-only)">
      <div className="space-y-3">
        <Alert>{err}</Alert>
        {!d && !err && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}

        {d && (
          <>
            <div className="flex items-center gap-3">
              <Avatar id={d.user.id} v={d.user.photoV} name={d.user.name} hasPhoto={d.user.hasPhoto} size="lg" />
              <div className="min-w-0">
                <div className="break-words text-xl font-extrabold">{d.user.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="violet">{d.user.role}</Badge>
                  <Badge tone={d.user.isActive ? "green" : "red"}>{d.user.isActive ? "Active" : "Disabled"}</Badge>
                </div>
              </div>
            </div>

            <div>
              <Row label="Email">{d.user.email}</Row>
              <Row label="Username">{d.user.username ? `@${d.user.username}` : ""}</Row>
              <Row label="Mobile">{d.user.phone}</Row>
                            <Row label="Date of birth">{d.user.dob ? fmtDate(d.user.dob) : ""}</Row>
              {isStudent ? (
                <>
                  <Row label="Class">{d.profile.className}</Row>
                  <Row label="Roll number">{d.profile.rollNumber}</Row>
                  <Row label="Subjects">{badges(d.profile.subjects, "violet")}</Row>
                  <Row label="Guardian name">{d.profile.guardianName}</Row>
                  <Row label="Guardian contact">{d.profile.guardianPhone}</Row>
                </>
              ) : (
                <>
                  <Row label="Employee ID">{d.profile.employeeId}</Row>
                  <Row label="Classes">{badges(d.profile.classNames, "violet")}</Row>
                  <Row label="Subjects">{badges(d.profile.subjects, "green")}</Row>
                  <div className="border-t border-brand-500/10 py-2">
                    <span className="text-xs font-extrabold uppercase opacity-60">Bio</span>
                    <p className="mt-1 whitespace-pre-line break-words text-sm font-semibold">{d.profile.bio || "—"}</p>
                  </div>
                </>
              )}
              <Row label="Last sign-in">{when(d.user.lastLoginAt)}</Row>
              <Row label="Account created">{when(d.user.createdAt)}</Row>
            </div>

            <p className="text-xs font-semibold opacity-60">
              Read-only. Only the person themselves can change their photo, phone, guardian and bio.
            </p>
          </>
        )}

        <Button variant="soft" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}