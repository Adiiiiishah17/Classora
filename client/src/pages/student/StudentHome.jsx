import { useAuth } from "../../context/AuthContext";
import { SectionHeading } from "../../components/ui";
import { useTab } from "../../utils/useTab";
import { labelFor } from "../../utils/nav";
import AttendanceSummary from "../../components/AttendanceSummary";
import MyLeaves from "../../components/MyLeaves";
import Announcements from "../../components/Announcements";
import Documents from "../../components/Documents";
import MyProfile from "../../components/MyProfile";
import TutorList from "../../components/TutorList";
import MySecurity from "../../components/MySecurity"; 

export default function StudentHome() {
  const { user } = useAuth();
  const [tab] = useTab("student");

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`Hello, ${user.name.split(" ")[0]}`} title={labelFor("student", tab)} />
      {tab === "attendance" && <AttendanceSummary />}
      {tab === "leave" && <MyLeaves approver="the admin" />}
      {tab === "announcements" && <Announcements />}
      {tab === "documents" && <Documents />}
      {tab === "profile" && <MyProfile />}
      {tab === "tutor" && <TutorList />}
       {tab === "security" && <MySecurity />}
    </div>
  );
}