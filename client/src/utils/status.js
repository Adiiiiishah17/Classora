export const ATT_ORDER = ["present", "absent", "late", "leave"];

export const ATT = {
  present: { label: "Present", short: "P", on: "bg-emerald-500 text-white",
    cell: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-200" },
  absent: { label: "Absent", short: "A", on: "bg-rose-500 text-white",
    cell: "bg-rose-100 text-rose-800 dark:bg-rose-500/25 dark:text-rose-200" },
  late: { label: "Late", short: "L", on: "bg-amber-500 text-white",
    cell: "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200" },
  leave: { label: "On leave", short: "OL", on: "bg-sky-500 text-white",
    cell: "bg-sky-100 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200" },
};

export const LEAVE_TONE = { pending: "amber", approved: "green", rejected: "red", cancelled: "gray" };