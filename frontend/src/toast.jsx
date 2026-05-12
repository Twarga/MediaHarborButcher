import { useEffect, useState } from "react";
import { IconCheck, IconX, IconAlert } from "./icons";

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

  const styles = {
    info:    { bg: "bg-ink-600", border: "border-ink-400",   text: "text-paper-100", Icon: IconAlert,  accent: "text-paper-300" },
    success: { bg: "bg-ink-700", border: "border-teal-500/50", text: "text-paper-100", Icon: IconCheck, accent: "text-teal-400"  },
    error:   { bg: "bg-ink-700", border: "border-coral-500/50",text: "text-paper-100", Icon: IconX,     accent: "text-coral-400" },
    warn:    { bg: "bg-ink-700", border: "border-amber-400/50",text: "text-paper-100", Icon: IconAlert, accent: "text-amber-300" },
  };

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const s = styles[t.type] || styles.info;
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${s.border} ${s.bg} ${s.text} min-w-[260px] max-w-sm shadow-lg backdrop-blur-sm`}
            style={{ animation: "slideIn 0.2s ease-out" }}
          >
            <span className={`${s.accent} mt-0.5 shrink-0`}>
              <s.Icon size={16} strokeWidth={2.25} />
            </span>
            <span className="text-sm flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
