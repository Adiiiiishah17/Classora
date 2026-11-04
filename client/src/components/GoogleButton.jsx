import { useEffect, useRef } from "react";
import { useTheme } from "../context/ThemeContext";

export default function GoogleButton({ onCredential }) {
  const box = useRef(null);
  const cb = useRef(onCredential);
  const { theme } = useTheme();
  cb.current = onCredential;

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    let tries = 0;
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => cb.current(r.credential),
        });
        box.current.innerHTML = "";
        window.google.accounts.id.renderButton(box.current, {
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          width: 320,
        });
      } else if (++tries > 50) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [theme]);

  return <div ref={box} className="flex justify-center" />;
}