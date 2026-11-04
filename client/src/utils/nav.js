import {
  BookOpen, CalendarCheck, CalendarX, FileText, GraduationCap, History,
  Inbox, Layers,LayoutDashboard, Megaphone, School, ShieldCheck, User, Users,
} from "lucide-react";

// One list per role. `key` goes in the address (?tab=key).
export const NAV = {
  admin: [
        { label: "", items: [
      { key: "overview", label: "Overview", icon: LayoutDashboard },
    ] },
    { label: "People", items: [
      { key: "students", label: "Students", icon: GraduationCap },
      { key: "teachers", label: "Teachers", icon: Users },
    ] },
    { label: "Academics", items: [
      { key: "classes", label: "Classes", icon: School },
      { key: "batches", label: "Batches", icon: Layers },
      { key: "attendance", label: "Attendance", icon: CalendarCheck },
      { key: "leaves", label: "Leaves", icon: CalendarX },
    ] },
    { label: "Communication", items: [
      { key: "documents", label: "DPP / PDF", icon: FileText },
      { key: "announcements", label: "Announcements", icon: Megaphone },
    ] },
    { label: "Administration", items: [
      { key: "requests", label: "Requests", icon: Inbox },
      { key: "activity", label: "Activity", icon: History },
      { key: "security", label: "Security", icon: ShieldCheck },
    ] },
  ],
  teacher: [
    { label: "", items: [
      { key: "attendance", label: "My attendance", icon: CalendarCheck },
      { key: "students", label: "Students", icon: GraduationCap },
      { key: "leave", label: "My leave", icon: CalendarX },
      { key: "documents", label: "DPP / PDF", icon: FileText },
      { key: "announcements", label: "Announcements", icon: Megaphone },
      { key: "profile", label: "My profile", icon: User },
      { key: "security", label: "Sign-in & Security", icon: ShieldCheck },
    ] },
  ],
  student: [
    { label: "", items: [
      { key: "attendance", label: "Attendance", icon: CalendarCheck },
      { key: "leave", label: "Leave", icon: CalendarX },
      { key: "announcements", label: "Announcements", icon: Megaphone },
      { key: "documents", label: "DPP / PDF", icon: FileText },
      { key: "profile", label: "My profile", icon: User },
     { key: "security", label: "Sign-in & Security", icon: ShieldCheck },
      { key: "tutor", label: "Know your tutor", icon: BookOpen },
    ] },
  ],
};

export const DEFAULT_TAB = { admin: "overview", teacher: "attendance", student: "attendance" };

const flat = (role) => (NAV[role] || []).flatMap((g) => g.items);
export const labelFor = (role, key) => flat(role).find((i) => i.key === key)?.label || "";
export const validTab = (role, key) => (flat(role).some((i) => i.key === key) ? key : DEFAULT_TAB[role]);