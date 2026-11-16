import { useEffect, useState } from "react";
import { Link, Outlet, useSearchParams } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { NavProvider, useNav } from "../context/NavContext";
import { NAV, validTab } from "../utils/nav";
import ThemeToggle from "./ThemeToggle";
import ConfirmDialog from "./ConfirmDialog";
import NotificationBell from "./NotificationBell";
import Avatar from "./Avatar";
import { Badge, Button, cx } from "./ui";
import { disablePush } from "../utils/push";

const isDesktop = () => window.innerWidth >= 1024;

function Shell() {
  const { user, logout } = useAuth();
  const { badges } = useNav();
  const [sp] = useSearchParams();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(() => {
    try { return isDesktop() && localStorage.getItem("sidebar") !== "closed"; } catch { return isDesktop(); }
  });

  const groups = NAV[user.role] || [];
  const active = validTab(user.role, sp.get("tab"));

  function toggle() {
    const next = !open;
    setOpen(next);
    if (isDesktop()) {
      try { localStorage.setItem("sidebar", next ? "open" : "closed"); } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !isDesktop()) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function doLogout() {
    setBusy(true);
    try { await disablePush(); } catch { /* alerts were not on, or the browser blocked it */ }
    await logout(); // clears the cookie; the route guard then sends you to the sign-in page
  }

  return (
    <div className="min-h-dvh">
      <header className="fixed inset-x-0 top-3 z-40 flex justify-center px-3 sm:top-4">
        <div className="flex w-full max-w-5xl items-center justify-between gap-2 rounded-full bg-gradient-to-r from-brand-100 to-brand-50 px-3 py-2 shadow-lg shadow-brand-500/20 ring-1 ring-brand-500/20 sm:px-5 dark:from-slate-900 dark:to-slate-800 dark:shadow-none">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggle}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="sidebar"
              className="bouncy flex h-10 w-10 items-center justify-center rounded-full bg-white/70 dark:bg-slate-700"
            >
              <Menu size={20} />
            </button>
            <div className="font-heading whitespace-nowrap text-xl font-extrabold sm:text-2xl">
                          <span className="bg-gradient-to-r from-brand-500 to-accent-500 bg-clip-text text-transparent">Classora</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap sm:gap-3">
            <Avatar id={user.id} v={user.photoV} name={user.name} hasPhoto={user.hasPhoto === true} size="sm" />
            <span className="hidden max-w-[10rem] truncate text-sm font-bold md:inline">{user.name}</span>
            <span className="hidden sm:inline"><Badge tone="violet">{user.role}</Badge></span>
            <NotificationBell />
            <ThemeToggle />
            <Button variant="soft" className="!px-3 sm:!px-5" onClick={() => setConfirmOpen(true)}>Log out</Button>
          </div>
        </div>
      </header>

      {/* Phones: dark layer behind the open menu */}
      {open && (
        <div className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="sidebar"
        className={cx(
          "fixed bottom-3 left-3 top-20 z-30 w-64 overflow-y-auto rounded-3xl border border-brand-500/20 bg-gray-100 p-3 shadow-lg shadow-brand-500/10 transition-transform duration-200 sm:top-24 dark:bg-slate-900 dark:shadow-none",
          open ? "translate-x-0" : "invisible -translate-x-[110%]"
        )}
      >
        <nav aria-label="Main menu">
          {groups.map((g, gi) => (
            <div key={g.label || gi} className="mb-4">
              {g.label && <p className="eyebrow mb-1 px-3 !text-xs">{g.label}</p>}
              <ul className="space-y-1">
                {g.items.map(({ key, label, icon: Icon }) => {
                  const on = active === key;
                  const count = badges[key];
                  return (
                    <li key={key}>
                      <Link
                        to={{ search: `?tab=${key}` }}
                        aria-current={on ? "page" : undefined}
                        onClick={() => { if (!isDesktop()) setOpen(false); }}
                        className={cx(
                          "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold transition",
                          on
                            ? "bg-brand-500 text-white"
                            : "text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-slate-800"
                        )}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="truncate">{label}</span>
                        {count > 0 && (
                          <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs font-extrabold text-white">{count}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className={cx("transition-[padding] duration-200", open && "lg:pl-72")}>
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-24 sm:px-6 sm:pt-28">
          <Outlet />
        </div>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        title="Log out?"
        message="You will need to sign in again to use your account."
        confirmText="Yes, log out"
        cancelText="Stay signed in"
        busy={busy}
        busyText="Logging out…"
        onConfirm={doLogout}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default function Layout() {
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}