import { useState } from "react";
import { toast } from "../toast";

export default function DownloadBar({ selected, onDownload, downloadState, onReset, onOpenFolder, onRetryFailed }) {
  const { status, done, total, speed, fileLogs, outputDir, failedItems = [], errors = 0, skipped = 0 } = downloadState;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-4 py-3 z-50">
      {status === "idle" && (
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <span className="text-gray-400 text-sm">{selected.size} selected</span>
          <button
            onClick={onDownload}
            disabled={selected.size === 0}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors"
          >
            Download Selected ({selected.size})
          </button>
        </div>
      )}

      {status === "downloading" && (
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Downloading {done}/{total} ({pct}%)</span>
            <span>{speed} MB/s</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-gray-500 font-mono max-h-12 overflow-hidden">
            {fileLogs.slice(-3).map((l, i) => (
              <div key={i} className={l.startsWith("❌") ? "text-red-400" : ""}>{l}</div>
            ))}
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-sm">
              ✅ {done} downloaded
            </span>
            {skipped > 0 && <span className="text-gray-400 text-sm">• {skipped} skipped (duplicate)</span>}
            {errors > 0 && (
              <span className="text-red-400 text-sm">• {errors} failed</span>
            )}
            <button
              onClick={() => onOpenFolder(outputDir).catch(err => toast(err.message, "error"))}
              className="ml-auto px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Open Folder
            </button>
            {failedItems.length > 0 && onRetryFailed && (
              <button
                onClick={() => onRetryFailed(failedItems)}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-sm font-semibold"
              >
                Retry Failed ({failedItems.length})
              </button>
            )}
            <button
              onClick={onReset}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm"
            >
              New Harvest
            </button>
          </div>

          {failedItems.length > 0 && (
            <div className="border border-red-900/40 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full px-3 py-2 bg-red-950/30 hover:bg-red-950/50 text-xs text-red-300 text-left flex justify-between items-center"
              >
                <span>{expanded ? "▼" : "▶"} Show failure details ({failedItems.length})</span>
                <span className="text-red-500/60">tried with {failedItems[0]?.engine || "http"}</span>
              </button>
              {expanded && (
                <div className="max-h-40 overflow-y-auto bg-gray-950 p-2 space-y-1 font-mono text-[11px]">
                  {failedItems.map((f, i) => (
                    <div key={i} className="text-red-400 truncate" title={f.url + " — " + f.error}>
                      <span className="text-gray-600">[{f.engine} ×{f.attempts}]</span>{" "}
                      <span className="text-red-300">{f.error}</span>{" "}
                      <span className="text-gray-500">{f.url.split("/").pop().slice(0, 60)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
