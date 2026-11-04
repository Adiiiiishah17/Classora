import { useSocket } from "../context/SocketContext";
import { cx } from "./ui";

export default function LiveDot() {
  const { connected } = useSocket();
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold dark:bg-slate-900">
      <span className={cx("h-2 w-2 rounded-full", connected ? "animate-pulse bg-emerald-500" : "bg-gray-400")} />
      {connected ? "Live" : "Connecting…"}
    </span>
  );
}