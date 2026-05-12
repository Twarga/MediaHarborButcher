import { useState } from "react";
import { toast } from "../toast";
import {
  IconDownload, IconCheck, IconAlert, IconFolderOpen, IconRefresh, IconArrowRight,
} from "../icons";

export default function DownloadBar({ selected, onDownload, downloadState, onReset, onOpenFolder, onRetryFailed }) {
  const { status, done, total, speed, fileLogs = [], outputDir, failedItems = [], errors = 0, skipped = 0 } = downloadState;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md bg-ink-900/90 border-t border-ink-500">
      <div className="max-w-6xl mx-auto px-6 py-4">

        {status === "idle" && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-paper-400 text-sm font-mono">
              {selected.size} <span className="text-paper-600">selected</span>
            </span>
            <button
              onClick={onDownload}
              disabled={selected.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-ink-500 disabled:text-paper-500 disabled:cursor-not-allowed text-ink-900 font-semibold rounded-lg transition-colors shadow-glow-amber disabled:shadow-none"
            >
              <IconDownload size={16} strokeWidth={2.25} />
              Download {selected.size > 0 && `(${selected.size})`}
            </button>
          </div>
        )}

        {status === "downloading" && (
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-paper-200 font-medium">
                Downloading{" "}
                <span className="font-mono text-paper-500">
                  {done}/{total}
                </span>
              </span>
              <span className="font-mono text-amber-300">{speed} MB/s</span>
            </div>
            <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-coral-400 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-paper-500 h-8 overflow-hidden">
              {fileLogs.slice(-2).map((l, i) => (
                <div
                  key={i}
                  className={`truncate ${l.kind === "err" ? "text-coral-400" : "text-paper-400"}`}
                >
                  {l.kind === "err" ? "✕ " : "✓ "}{l.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 text-teal-400 font-medium text-sm">
                <IconCheck size={15} strokeWidth={2.5} /> {done} downloaded
              </span>
              {skipped > 0 && (
                <span className="text-paper-500 text-sm font-mono">· {skipped} skipped</span>
              )}
              {errors > 0 && (
                <span className="inline-flex items-center gap-1 text-coral-400 text-sm font-mono">
                  · <IconAlert size={12} /> {errors} failed
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => onOpenFolder(outputDir).catch((err) => toast(err.message, "error"))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink-700 hover:bg-ink-500 text-paper-200 text-sm font-medium transition-colors"
                >
                  <IconFolderOpen size={14} /> Open folder
                </button>
                {failedItems.length > 0 && onRetryFailed && (
                  <button
                    onClick={() => onRetryFailed(failedItems)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-coral-500/20 hover:bg-coral-500/30 border border-coral-500/40 text-coral-300 text-sm font-medium transition-colors"
                  >
                    <IconRefresh size={14} /> Retry ({failedItems.length})
                  </button>
                )}
                <button
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-ink-900 text-sm font-semibold transition-colors"
                >
                  New harvest <IconArrowRight size={14} />
                </button>
              </div>
            </div>

            {failedItems.length > 0 && (
              <div className="rounded-xl border border-coral-500/30 overflow-hidden">
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="w-full px-4 py-2 bg-coral-500/10 hover:bg-coral-500/15 text-xs text-coral-300 text-left flex justify-between items-center font-mono"
                >
                  <span>{expanded ? "▼" : "▶"} failure details ({failedItems.length})</span>
                  <span className="text-coral-400/70">
                    engine: {failedItems[0]?.engine || "http"}
                  </span>
                </button>
                {expanded && (
                  <div className="max-h-44 overflow-y-auto bg-ink-900 p-3 space-y-1 font-mono text-[11px]">
                    {failedItems.map((f, i) => (
                      <div key={i} className="truncate" title={`${f.url} — ${f.error}`}>
                        <span className="text-paper-600">[{f.engine} ×{f.attempts}]</span>{" "}
                        <span className="text-coral-400">{f.error}</span>{" "}
                        <span className="text-paper-500">{f.url.split("/").pop().slice(0, 50)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
