import { useState } from "react";
import { api, errMsg } from "../../api/client";
import { Alert, Badge, Card } from "../../components/ui";

export default function GroupsTab({ kind, data }) {
  const isClass = kind === "class";
  const groups = isClass ? data.classGroups : data.batches;

  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const title = (n) => (isClass ? `🏫 Class ${n}` : `📚 ${n}`);

  async function show(name) {
    setOpen(name);
    setDetail(null);
    setErr("");
    setLoading(true);
    try {
      const base = isClass ? "class-groups" : "batches";
      const r = await api.get(`/admin/${base}/${encodeURIComponent(name)}`);
      setDetail(r.data);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  if (open) {
    return (
      <div className="space-y-4">
        <button onClick={() => setOpen(null)} className="text-sm font-extrabold text-brand-600 hover:underline dark:text-brand-300">
          ← All {isClass ? "classes" : "batches"}
        </button>
        <Alert>{err}</Alert>
        {loading && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}

        {detail && (
          <>
            <div className="rounded-3xl bg-gradient-to-r from-brand-500 to-accent-500 p-6 text-white">
              <h2 className="text-2xl font-extrabold">{title(detail.name)}</h2>
              <p className="mt-1 text-sm font-semibold opacity-90">
                {detail.students.length} student{detail.students.length === 1 ? "" : "s"} · {detail.teachers.length} teacher{detail.teachers.length === 1 ? "" : "s"}
              </p>
            </div>

            <Card>
              <h3 className="mb-3 text-lg font-extrabold">👩‍🏫 Teachers</h3>
              <div className="space-y-2">
                {detail.teachers.map((t) => (
                  <div key={t._id} className="rounded-2xl bg-brand-50 p-3 text-sm dark:bg-slate-800">
                    <div className="font-extrabold">{t.userId?.name} <span className="text-xs font-bold opacity-60">@{t.userId?.username}</span></div>
                    <div className="text-xs opacity-70">{t.userId?.email} · 📱 {t.userId?.phone}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {isClass
                        ? t.subjects?.map((s) => <Badge key={s} tone="green">📚 {s}</Badge>)
                        : t.classNames?.map((c) => <Badge key={c} tone="violet">Class {c}</Badge>)}
                      <Badge tone={t.userId?.isActive ? "green" : "red"}>{t.userId?.isActive ? "Active" : "Disabled"}</Badge>
                    </div>
                  </div>
                ))}
                {!detail.teachers.length && <p className="text-sm opacity-60">No teacher here yet.</p>}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 text-lg font-extrabold">🎒 Students</h3>
              {detail.students.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase opacity-60">
                        <th className="py-2 pr-3">Name</th>
                        <th className="pr-3">{isClass ? "Subjects" : "Class"}</th>
                        <th className="pr-3">Roll</th>
                        <th className="pr-3">Contact</th>
                        <th className="pr-3">Guardian</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.students.map((s) => (
                        <tr key={s._id} className="border-t border-brand-100 align-top dark:border-slate-800">
                          <td className="py-2 pr-3 font-extrabold">
                            {s.userId?.name}
                            <div className="text-xs font-bold opacity-60">@{s.userId?.username}</div>
                          </td>
                          <td className="pr-3 text-xs">
                            {isClass ? (s.subjects?.length ? s.subjects.join(", ") : "—") : s.className || "No class yet"}
                          </td>
                          <td className="pr-3">{s.rollNumber || "—"}</td>
                          <td className="pr-3 text-xs">{s.userId?.email}<br />📱 {s.userId?.phone}</td>
                          <td className="pr-3 text-xs">{s.guardianName || "—"}{s.guardianPhone ? <><br />📱 {s.guardianPhone}</> : null}</td>
                          <td><Badge tone={s.userId?.isActive ? "green" : "red"}>{s.userId?.isActive ? "Active" : "Disabled"}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm opacity-60">No student here yet.</p>
              )}
            </Card>
          </>
        )}
      </div>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-extrabold">{isClass ? "Classes" : "Batches (by subject)"}</h2>
      <p className="mb-4 text-xs font-semibold opacity-70">
        {isClass
          ? "These form automatically from the class typed for each student and teacher. Click one to see who is in it."
          : "These form automatically from the subjects typed for each student and teacher. Click one to see who is in it."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <button key={g.name} onClick={() => show(g.name)} className="bouncy rounded-2xl bg-brand-50 p-4 text-left dark:bg-slate-800">
            <div className="text-xl font-extrabold">{title(g.name)}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge tone="violet">🎒 {g.students} student{g.students === 1 ? "" : "s"}</Badge>
              <Badge tone="green">👩‍🏫 {g.teachers} teacher{g.teachers === 1 ? "" : "s"}</Badge>
            </div>
            <div className="mt-2 text-xs font-bold text-brand-600 dark:text-brand-300">View details →</div>
          </button>
        ))}
        {!groups.length && (
          <p className="text-sm opacity-60">
            Nothing here yet. Add a student or teacher with a {isClass ? "class" : "subject"} and it appears automatically.
          </p>
        )}
      </div>
    </Card>
  );
}