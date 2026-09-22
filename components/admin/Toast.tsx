"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error";
interface ToastItem { id: number; type: ToastType; message: string }
interface ToastContextValue { showToast: (type: ToastType, message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

// Any admin screen can call useToast() — the provider lives once in AdminShell,
// so a missing provider (component rendered outside the admin shell) is a real
// bug, not a state to silently swallow.
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const CheckIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const AlertIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </svg>
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed", bottom: "1.25rem", right: "1.25rem", zIndex: 400,
          display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: "min(360px, calc(100vw - 2rem))",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="ew-toast"
            data-type={t.type}
            onClick={() => dismiss(t.id)}
          >
            <span className="ew-toast-icon">{t.type === "success" ? CheckIcon : AlertIcon}</span>
            <span className="ew-toast-msg">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
