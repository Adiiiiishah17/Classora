import { api } from "../api/client";

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function toKey(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function pushState() {
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? "on" : "off";
}

export async function enablePush() {
  if (!supported()) throw new Error("This browser does not support phone alerts.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Alerts are blocked. Allow notifications in the browser settings.");

  const { data } = await api.get("/notifications/vapid-key");
  if (!data.key) throw new Error("Phone alerts are not set up on the server yet.");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(data.key) }));
  await api.post("/notifications/push-subscription", sub.toJSON());
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await api.delete("/notifications/push-subscription", { data: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}