import { useEffect, useRef } from "react";

export default function ScanProgress({ logs, counts, done }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      {/* Counters row */}
      <div className="flex gap-3 mb-3">
        <Counter label="Images" value={counts.images} color="purple" active={!done} />
        <Counter label="Videos" value={counts.videos} color="pink" active={!done} />
        <div className="ml-auto flex items-center gap-2 text-sm">
          {done ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-950/50 border border-green-800 text-green-400 text-xs font-medium">
              <span>✓</span> Scan complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-950/50 border border-purple-800 text-purple-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              Scanning...
            </span>
          )}
        </div>
      </div>

      {/* Log panel */}
      <div
        ref={ref}
        className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-52 overflow-y-auto font-mono text-sm space-y-1"
      >
        {logs.length === 0 && !done && (
          <div className="text-gray-600 italic">Waiting for scanner...</div>
        )}
        {logs.map((log, i) => (
          <div
            key={i}
            className={
              log.startsWith("✅")
                ? "text-green-400"
                : log.startsWith("🔴")
                ? "text-red-400"
                : "text-blue-400"
            }
          >
            {log}
          </div>
        ))}
        {!done && <div className="text-purple-400 animate-pulse">▌</div>}
      </div>
    </div>
  );
}

function Counter({ label, value, color, active }) {
  const colorClass = {
    purple: "from-purple-600/30 to-purple-900/30 border-purple-700/40",
    pink: "from-pink-600/30 to-pink-900/30 border-pink-700/40",
  }[color];
  const textClass = { purple: "text-purple-300", pink: "text-pink-300" }[color];

  return (
    <div
      className={`flex items-baseline gap-2 px-4 py-2 rounded-lg bg-gradient-to-br border ${colorClass} ${active ? "animate-[pulse-purple_2s_ease-in-out_infinite]" : ""}`}
    >
      <span className={`text-2xl font-bold ${textClass}`}>{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
