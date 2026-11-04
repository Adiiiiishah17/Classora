import { useEffect, useState } from "react";
import { todayStr } from "./dates";

// Re-checks the date every minute, so a page left open overnight moves to the new day
export function useToday() {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const id = setInterval(() => setToday(todayStr()), 60000);
    return () => clearInterval(id);
  }, []);
  return today;
}