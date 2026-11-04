import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../api/client";
import { useLive } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import { Alert, Badge, Button, Card, cx } from "./ui";
import { ATT, ATT_ORDER } from "../utils/status";
import { fmtDate, monthLabel, shiftMonth, todayStr } from "../utils/dates";

// Present and Late count as attended. Leave days are left out of the total.
const tally = (s) => {
  const attended = s.present + s.late;
  return { attended, total: attended + s.absent };
};
const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);

export default function AttendanceSummary({ url = "/attendance/me" }) {
  const toast = useToast();
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get(url, { params: { month } });
      setData(r.data);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [url, month]);
  useEffect(() => { load(); }, [load]);

  useLive("attendance:marked", (p) => {
    toast(`📅 Attendance marked: ${ATT[p?.status]?.label || "updated"} on ${fmtDate(p?.date)}`);
    load();
  });

  if (!data) return error ? <Alert>{error}</Alert> : <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>;

  const m = tally(data.monthSummary);
  const all = tally(data.overall);
  const thisMonth = todayStr().slice(0, 7);

  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>

      {data.profile && (
        <div className="flex flex-wrap justify-center gap-2">
          <Badge tone="violet">{data.profile.className ? `Class ${data.profile.className}` : "No class yet"}</Badge>
          {data.profile.rollNumber && <Badge tone="violet">Roll #{data.profile.rollNumber}</Badge>}
          {data.profile.subjects.map((x) => <Badge key={x} tone="green">📚 {x}</Badge>)}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">{monthLabel(month)}</h2>
        <div className="flex gap-2">
          <Button variant="soft" className="!px-3 !py-1.5" onClick={() => { setData(null); setMonth(shiftMonth(month, -1)); }}>←</Button>
          <Button variant="soft" className="!px-3 !py-1.5" disabled={month >= thisMonth} onClick={() => { setData(null); setMonth(shiftMonth(month, 1)); }}>→</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="text-center">
          <div className="text-xs font-bold opacity-70">Attended this month</div>
          <div className="mt-1 text-4xl font-extrabold">{m.attended} / {m.total}</div>
          <div className="mt-1 text-sm font-bold">{pct(data.monthSummary.percentage)}</div>
        </Card>
        <Card className="text-center">
          <div className="text-xs font-bold opacity-70">Attended overall</div>
          <div className="mt-1 text-4xl font-extrabold">{all.attended} / {all.total}</div>
          <div className="mt-1 text-sm font-bold">{pct(data.overall.percentage)}</div>
        </Card>
      </div>

      <div className="flex flex-wrap justify-center gap-2 text-xs font-extrabold">
        {ATT_ORDER.map((k) => (
          <span key={k} className={cx("rounded-full px-3 py-1", ATT[k].cell)}>{ATT[k].label}: {data.monthSummary[k]}</span>
        ))}
      </div>
    </div>
  );
}