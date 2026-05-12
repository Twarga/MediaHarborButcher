import { useEffect, useRef } from "react";
import { IconImage, IconVideo, IconCheck, IconAlert } from "../icons";

export default function ScanProgress({ logs, counts, done }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  return (
    <section className="max-w-3xl mx-auto mt-8 anim-fade-up">
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <StatCard icon={IconImage} label="Images" value={counts.images} color="amber" active={!done} />
        <StatCard icon={IconVideo} label="Videos" value={counts.videos} color="coral" active={!done} />
        <div className="card p-4 flex flex-col justify-center items-start">
          <div className="text-xs text-paper-500 uppercase tracking-wide mb-1">Status</div>
          {done ? (
            <div className="flex items-center gap-2 text-teal-400 text-sm font-medium">
              <IconCheck size={14} strokeWidth={2.5} /> Complete
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 scan-dot" />
              Scanning…
            </div>
          )}
        </div>
      </div>

      {/* Log panel */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-ink-500">
          <span className="text-xs font-mono text-paper-500 uppercase tracking-wider">scanner.log</span>
          <span className="text-xs font-mono text-paper-600">{logs.length} events</span>
        </div>
        <div
          ref={ref}
          className="h-56 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed space-y-0.5"
        >
          {logs.length === 0 && !done && (
            <div className="text-paper-600 italic">waiting for events…</div>
          )}
          {logs.map((log, i) => (
            <LogLine key={i} log={log} />
          ))}
          {!done && <div className="text-amber-400 animate-pulse">▊</div>}
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon: Ic, label, value, color, active }) {
  const accent = color === "amber" ? "text-amber-300" : "text-coral-400";
  return (
    <div className={`card p-4 relative overflow-hidden ${active ? "card-hover" : ""}`}>
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-40
        ${color === "amber" ? "bg-amber-400/20" : "bg-coral-500/20"}`} />
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-paper-500 uppercase tracking-wide">{label}</span>
        <Ic size={14} className={`${accent} opacity-70`} />
      </div>
      <div className={`font-display text-4xl leading-none ${accent}`}>{value}</div>
    </div>
  );
}

function LogLine({ log }) {
  const { kind, msg } = log;
  const colors = {
    ok:   { icon: IconCheck, color: "text-teal-400" },
    info: { icon: null,      color: "text-paper-400" },
    err:  { icon: IconAlert, color: "text-coral-400" },
  }[kind] || { icon: null, color: "text-paper-400" };

  return (
    <div className={`flex items-baseline gap-2 ${colors.color}`}>
      <span className="text-paper-600 text-xs w-4 shrink-0">
        {colors.icon ? <colors.icon size={11} strokeWidth={2.5} /> : "·"}
      </span>
      <span className="break-all">{msg}</span>
    </div>
  );
}
