import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = useCallback((message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((list) => [...list.slice(-3), { id, message }]);
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className="animate-pop-in pointer-events-auto max-w-md rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-xl">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}