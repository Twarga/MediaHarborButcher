import { useEffect, useRef } from "react";

export default function ScanProgress({ logs, counts, done }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [logs]);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4">
      <div ref={ref} className="bg-gray-900 border border-gray-700 rounded-xl p-4 h-52 overflow-y-auto font-mono text-sm space-y-1">
        {logs.map((log, i) => (
          <div key={i} className={log.startsWith("✅") ? "text-green-400" : "text-blue-400"}>
            {log}
          </div>
        ))}
        {!done && <div className="text-gray-500 animate-pulse">▌</div>}
      </div>
      <div className="flex gap-6 mt-2 text-sm text-gray-400">
        <span>Images: <strong className="text-purple-400">{counts.images}</strong></span>
        <span>Videos: <strong className="text-purple-400">{counts.videos}</strong></span>
        {done && <span className="text-green-400 ml-auto">✅ Scan complete</span>}
      </div>
    </div>
  );
}
