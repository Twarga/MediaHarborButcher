// Tiny toast system — no dependencies. Call `toast('Done')` from anywhere.
import { useEffect, useState } from "react";

let listeners = [];
let nextId = 0;

export function toast(message, type = "info") {
  const t = { id: ++nextId, message, type };
  listeners.forEach((l) => l(t));
}

export function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const colors = {
    info: "bg-gray-800 border-gray-600 text-gray-100",
    success: "bg-green-900/80 border-green-700 text-green-100",
    error: "bg-red-900/80 border-red-700 text-red-100",
    warn: "bg-orange-900/80 border-orange-700 text-orange-100",
  };
  const icons = { info: "ℹ", success: "✓", error: "✕", warn: "!" };

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg min-w-[240px] max-w-sm backdrop-blur-sm animate-[slideIn_0.2s_ease-out] ${colors[t.type] || colors.info}`}
          style={{ animation: "slideIn 0.2s ease-out" }}
        >
          <span className="font-bold mt-0.5">{icons[t.type] || icons.info}</span>
          <span className="text-sm flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
