import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "../api/client";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, cx } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import PersonDetail from "./PersonDetail";
import { ATT, ATT_ORDER } from "../utils/status";
import { addDaysStr, fmtDate, todayStr } from "../utils/dates";
import { useToday } from "../utils/useToday";

const CFG = {
  student: { url: "/attendance/roster/students", idKey: "studentId", listKey: "students", empty: "No students found." },
  teacher: { url: "/attendance/teachers", idKey: "teacherId", listKey: "teachers", empty: "No teachers found." },
};

export default function AttendanceRoster({ kind, canEditDetail = false }) {
  const cfg = CFG[kind];
  const toast = useToast();
  const today = useToday();
  const [date, setDate] = useState(today);
  const prevToday = useRef(today);
  useEffect(() => {
    // If you were looking at "today" when the day changed, move to the new day
    setDate((d) => (d === prevToday.current ? today : d));
    prevToday.current = today;
  }, [today]);
  const [q, setQ] = useState("");
  const [reg, setReg] = useState(null);
  const [draft, setDraft] = useState({});
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await api.get(cfg.url, { params: { date } });
      const list = r.data[cfg.listKey];
      setReg(r.data);
      // People on approved leave start as "On leave" if nothing is saved yet
      const d = {};
      list.forEach((p) => { if (!p.status && p.onLeave) d[p[cfg.idKey]] = "leave"; });
      setDraft(d);
    } catch (e) {
      setReg(null);
      setError(errMsg(e));
    }
  }, [cfg, date]);
  useEffect(() => { setReg(null); load(); }, [load]);

  const people = reg ? reg[cfg.listKey] : [];
  const idOf = (p) => p[cfg.idKey];
  const stored = new Map(people.map((p) => [idOf(p), p.status || null]));
  const changes = Object.entries(draft).filter(([k, st]) => stored.has(k) && st !== stored.get(k));
  const effective = (p) => draft[idOf(p)] ?? p.status ?? null;

  // Someone else saved: refresh, unless you have unsaved changes
  const refresh = (p) => { if (!changes.length && (!p?.date || p.date === date)) load(); };
  useLive("attendance:updated", (p) => { if (kind === "student") refresh(p); });
  useLive("teacherattendance:updated", (p) => { if (kind === "teacher") refresh(p); });

  const term = q.trim().toLowerCase();
  const shown = term
    ? people.filter((p) => p.name.toLowerCase().includes(term) || p.username.toLowerCase().includes(term))
    : people;

  const counts = Object.fromEntries(ATT_ORDER.map((k) => [k, 0]));
  people.forEach((p) => { const s = effective(p); if (s) counts[s] += 1; });

  const setStatus = (id, st) => setDraft((d) => ({ ...d, [id]: st }));
  const markShownPresent = () =>
    setDraft((d) => { const n = { ...d }; shown.forEach((p) => { n[idOf(p)] = "present"; }); return n; });

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.put(cfg.url, {
        date,
        records: changes.map(([id, status]) => ({ [cfg.idKey]: id, status })),
      });
      toast(`✅ Attendance saved for ${fmtDate(date)}`);
      setConfirm(false);
      await load();
    } catch (e) {
      setError(errMsg(e));
      setConfirm(false);
    } finally {
      setSaving(false);
    }
  }

  if (detail) {
    return (
      <PersonDetail
        person={{ id: idOf(detail), name: detail.name, username: detail.username, role: kind, className: detail.className }}
        canEdit={canEditDetail}
        onBack={() => { setDetail(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or username"
          className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900"
        />
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-sm font-bold">
            <span className="mb-1 block">Date</span>
            <input
              type="date"
              max={todayStr()}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-2xl border border-brand-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <Button variant="soft" className="!px-3 !py-2" onClick={() => setDate(addDaysStr(date, -1))}>← Prev</Button>
          <Button variant="soft" className="!px-3 !py-2" disabled={date >= todayStr()} onClick={() => setDate(addDaysStr(date, 1))}>Next →</Button>
          <Button variant="soft" className="!px-3 !py-2" disabled={date === todayStr()} onClick={() => setDate(todayStr())}>Today</Button>
        </div>
      </Card>

      <Alert>{error}</Alert>
      {!reg && !error && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}

      {reg && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">
              {kind === "student" ? "Students" : "Teachers"} · {fmtDate(reg.date)}
              <span className="ml-2 text-xs font-bold opacity-60">{shown.length}</span>
            </h2>
            {reg.canEdit ? (
              shown.length > 0 && <Button variant="soft" className="!py-1.5" onClick={markShownPresent}>Mark all present</Button>
            ) : (
              <Badge tone="amber">🔒 Locked</Badge>
            )}
          </div>

          <div className="space-y-2">
            {shown.map((p) => {
              const id = idOf(p);
              const cur = effective(p);
              return (
                <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
                  <button onClick={() => setDetail(p)} className="min-w-0 text-left">
                    <div className="font-extrabold">
                      {p.name} <span className="text-xs font-bold opacity-60">@{p.username}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs font-bold">
                      {kind === "student" && p.className && <Badge tone="violet">Class {p.className}</Badge>}
                      <span className="rounded-full bg-white px-2 py-0.5 dark:bg-slate-900">{p.attended} / {p.total}</span>
                      {p.onLeave && <Badge tone="sky">🌴 Approved leave</Badge>}
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-1">
                    {ATT_ORDER.map((k) => (
                      <button
                        key={k}
                        type="button"
                        disabled={!reg.canEdit}
                        aria-pressed={cur === k}
                        onClick={() => setStatus(id, k)}
                        className={cx("rounded-full px-3 py-1.5 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60",
                          cur === k ? ATT[k].on : "bg-white text-gray-700 hover:bg-brand-100 dark:bg-slate-900 dark:text-gray-200")}
                      >
                        <span className="sm:hidden">{ATT[k].short}</span>
                        <span className="hidden sm:inline">{ATT[k].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {!shown.length && <p className="text-sm opacity-60">{cfg.empty}</p>}
          </div>
        </Card>
      )}

      {reg && reg.canEdit && people.length > 0 && (
        <div className="sticky bottom-3 z-10">
          <Card className="flex flex-wrap items-center justify-between gap-3 !py-3 shadow-xl">
            <div className="flex flex-wrap gap-1 text-xs font-extrabold">
              {ATT_ORDER.map((k) => <span key={k} className={cx("rounded-full px-3 py-1", ATT[k].cell)}>{ATT[k].label} {counts[k]}</span>)}
            </div>
            <Button disabled={!changes.length || saving} onClick={() => setConfirm(true)}>
              {changes.length ? `Save ${changes.length} change${changes.length === 1 ? "" : "s"}` : "Save"}
            </Button>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        icon="📋"
        title="Save attendance?"
        message={`${changes.length} change${changes.length === 1 ? "" : "s"} for ${fmtDate(date)}.`}
        confirmText="Yes, save"
        cancelText="Review again"
        confirmVariant="primary"
        busy={saving}
        busyText="Saving…"
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}