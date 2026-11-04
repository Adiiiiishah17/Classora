import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Modal } from "./ui";

export default function LoginCodeModal({ info, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!info) return null;

  const raw = info.code.replace(/-/g, "");
  // The code sits after the # so it is never sent to any server or written to logs
  const url = `${window.location.origin}/login?tab=code#c=${raw}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(info.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal open onClose={onClose} title={`Login code for ${info.name}`}>
      <div className="space-y-3 text-center text-sm">
        <div className="mx-auto w-fit rounded-2xl bg-white p-4 ring-1 ring-brand-100">
          <QRCodeSVG value={url} size={200} level="M" />
        </div>
        <div className="rounded-2xl bg-brand-50 p-3 font-mono text-xl font-extrabold tracking-widest dark:bg-slate-800">
          {info.code}
        </div>
        <p className="font-semibold opacity-80">
          Scan with a phone camera, or type the code on the sign-in page (Login code tab).
        </p>
        <p className="text-xs font-semibold opacity-70">
          You can open this again any time with <b>🔑 Login credentials → View code</b>. Anyone with this code can sign in as {info.name},
          so share it privately. Making a new code stops this one from working.
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="soft" onClick={copy}>{copied ? "Copied ✅" : "Copy code"}</Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}