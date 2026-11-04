import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, cx } from "./ui";
import ConfirmDialog from "./ConfirmDialog";
import { ATT, ATT_ORDER } from "../utils/status";
import { fmtDate, monthLabel, shiftMonth, todayStr } from "../utils/dates";

const dayLabel = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
};

export default function PersonDetail({ person, canEdit = false, onBack }) {
  const toast = useToast();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [change, setChange] = useState(null); // { date, status }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/attendance/person/${person.id}`, { params: { month } });
      setData(r.data);
      setError("");
    } catch (e) {
      setData(null);
      setError(errMsg(e));
    }
  }, [person.id, month]);
  useEffect(() => { load(); }, [load]);

  async function apply() {
    setBusy(true);
    try {
      await api.put(`/attendance/person/${person.id}`, change);
      toast(`✅ Attendance updated for ${person.name}`);
      setChange(null);
      await load();
    } catch (e) {
      setError(errMsg(e));
      setChange(null);
    } finally {
      setBusy(false);
    }
  }

  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const days = [];
  if (data) {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = last; d >= 1; d--) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      if (date <= today) days.push(date);
    }
  }
  const byDate = new Map((data?.records || []).map((r) => [r.date, r.status]));
  const s = data?.monthSummary;
  const attended = s ? s.present + s.late : 0;
  const total = s ? attended + s.absent : 0;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-extrabold text-brand-600 hover:underline dark:text-brand-300">← Back</button>
      <Alert>{error}</Alert>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold">{person.name} <span className="text-xs font-bold opacity-60">@{person.username}</span></h2>
            <div className="mt-1 flex gap-1">
              <Badge tone="violet">{person.role}</Badge>
              {person.className && <Badge tone="violet">Class {person.className}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold">{monthLabel(month)}</span>
            <Button variant="soft" className="!px-3 !py-1.5" onClick={() => { setData(null); setMonth(shiftMonth(month, -1)); }}>←</Button>
            <Button variant="soft" className="!px-3 !py-1.5" disabled={month >= thisMonth} onClick={() => { setData(null); setMonth(shiftMonth(month, 1)); }}>→</Button>
          </div>
        </div>

        {!data ? (
          <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-extrabold">{attended} / {total}</span>
              <span className="text-sm font-bold opacity-70">{s.percentage === null ? "—" : `${s.percentage}%`}</span>
            </div>

            <div className="space-y-2">
              {days.map((date) => {
                const cur = byDate.get(date);
                return (
                  <div key={date} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
                    <div className="text-sm font-extrabold">{dayLabel(date)}</div>
                    {canEdit ? (
                      <div className="flex flex-wrap gap-1">
                        {ATT_ORDER.map((k) => (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={cur === k}
                            onClick={() => cur !== k && setChange({ date, status: k })}
                            className={cx("rounded-full px-3 py-1.5 text-xs font-extrabold transition",
                              cur === k ? ATT[k].on : "bg-white text-gray-700 hover:bg-brand-100 dark:bg-slate-900 dark:text-gray-200")}
                          >
                            <span className="sm:hidden">{ATT[k].short}</span>
                            <span className="hidden sm:inline">{ATT[k].label}</span>
                          </button>
                        ))}
                      </div>
                    ) : cur ? (
                      <span className={cx("rounded-full px-3 py-1 text-xs font-extrabold", ATT[cur].cell)}>{ATT[cur].label}</span>
                    ) : (
                      <span className="text-xs font-bold opacity-50">—</span>
                    )}
                  </div>
                );
              })}
              {!days.length && <p className="text-sm opacity-60">No days to show.</p>}
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!change}
        icon="📋"
        title="Change attendance?"
        message={change ? `${person.name}: ${ATT[change.status].label} on ${fmtDate(change.date)}.` : ""}
        confirmText="Yes, change"
        cancelText="Cancel"
        confirmVariant="primary"
        busy={busy}
        busyText="Saving…"
        onConfirm={apply}
        onCancel={() => setChange(null)}
      />
    </div>
  );
}