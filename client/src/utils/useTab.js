import { useSearchParams } from "react-router-dom";
import { validTab } from "./nav";

// The open page lives in the address, so refresh and Back keep working
export function useTab(role) {
  const [sp, setSp] = useSearchParams();
  const tab = validTab(role, sp.get("tab"));
  return [tab, (t) => setSp({ tab: t })];
}