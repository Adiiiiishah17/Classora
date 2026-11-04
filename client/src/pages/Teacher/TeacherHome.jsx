import { useAuth } from "../../context/AuthContext";
import { SectionHeading } from "../../components/ui";
import { useTab } from "../../utils/useTab";
import { labelFor } from "../../utils/nav";
import AttendanceRoster from "../../components/AttendanceRoster";
import AttendanceSummary from "../../components/AttendanceSummary";
import { MyAttendanceRequests } from "../../components/AttendanceRequests";
import MyLeaves from "../../components/MyLeaves";
import Announcements from "../../components/Announcements";
import Documents from "../../components/Documents";
import MyProfile from "../../components/MyProfile";
import MySecurity from "../../components/MySecurity";

export default function TeacherHome() {
  const { user } = useAuth();
  const [tab] = useTab("teacher");

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`Hello, ${user.name.split(" ")[0]}`} title={labelFor("teacher", tab)} />
      {tab === "attendance" && (
        <div className="space-y-6">
          <AttendanceSummary url="/attendance/teachers/me" />
          <MyAttendanceRequests />
        </div>
      )}
      {tab === "students" && <AttendanceRoster kind="student" />}
      {tab === "leave" && <MyLeaves approver="the admin" />}
      {tab === "documents" && <Documents canPost role="teacher" />}
      {tab === "announcements" && <Announcements canPost role="teacher" />}
      {tab === "profile" && <MyProfile />}
     {tab === "security" && <MySecurity />}
    </div>
  );
}