import { useState } from "react";
import Tabs from "../../components/Tabs";
import AttendanceRoster from "../../components/AttendanceRoster";
import { AttendanceRequestInbox } from "../../components/AttendanceRequests";

export default function AttendanceTab() {
  const [sub, setSub] = useState("Students");
  return (
    <div className="space-y-4">
      <Tabs tabs={["Students", "Teachers", "Teacher requests"]} value={sub} onChange={setSub} />
      {sub === "Students" && <AttendanceRoster key="student" kind="student" canEditDetail />}
      {sub === "Teachers" && <AttendanceRoster key="teacher" kind="teacher" canEditDetail />}
      {sub === "Teacher requests" && <AttendanceRequestInbox />}
    </div>
  );
}