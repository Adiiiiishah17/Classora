import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../../api/client";
import { Alert, Badge, Button, Card } from "../../components/ui";
import { fmtDateTime } from "../../utils/dates";

const LABEL = {
  "attendance.mark": ["Attendance marked", "green"],
  "attendance.edit": ["Attendance edited", "amber"],
  "attendance.teacher.mark": ["Teacher attendance marked", "green"],
  "attendance.teacher.edit": ["Teacher attendance edited", "amber"],
  "attreq.approve": ["Attendance request approved", "green"],
  "attreq.reject": ["Attendance request rejected", "red"],
  "leave.approve": ["Leave approved", "green"],
  "leave.reject": ["Leave rejected", "red"],
  "request.approve": ["Request approved", "green"],
  "request.reject": ["Request rejected", "red"],
  "user.enable": ["User enabled", "green"],
  "user.disable": ["User disabled", "red"],
  "user.passwordreset": ["Password reset", "amber"],
  "logincode.view": ["Login code viewed", "violet"],
    "announcement.post": ["Announcement posted", "violet"],
  "announcement.delete": ["Announcement deleted", "red"],
    "document.post": ["File shared", "violet"],
  "document.delete": ["File deleted", "red"],
    "photo.update": ["Photo changed", "violet"],
  "photo.remove": ["Photo removed", "gray"],
  "profile.update": ["Profile edited", "violet"],
  "profile.view": ["Profile viewed", "sky"],
    "mylogincode.create": ["Own login code made", "violet"],
  "mylogincode.view": ["Own login code viewed", "sky"],
  "mylogincode.revoke": ["Own login code removed", "gray"],
};

export default function ActivityTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get("/admin/audit");
      setItems(r.data.items);
      setError("");
    } catch (e) {
      setItems([]);
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold">Activity log</h2>

        </div>
        <Button variant="soft" onClick={load}>🔄 Refresh</Button>
      </div>
      <Alert>{error}</Alert>
      <div className="space-y-2">
        {(items || []).map((a) => {
          const [label, tone] = LABEL[a.action] || [a.action, "gray"];
          return (
            <div key={a._id} className="rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone}>{label}</Badge>
                <span className="text-xs font-bold opacity-70">{fmtDateTime(a.createdAt)}</span>
              </div>
              <div className="mt-1 break-words text-sm font-semibold">{a.summary}</div>
              <div className="text-xs opacity-60">by {a.actorName || "unknown"} ({a.actorRole || "?"})</div>
            </div>
          );
        })}
        {items && !items.length && <p className="text-sm opacity-60">No activity recorded yet.</p>}
        {!items && <p className="text-sm font-semibold opacity-60">Loading… ⏳</p>}
      </div>
    </Card>
  );
}