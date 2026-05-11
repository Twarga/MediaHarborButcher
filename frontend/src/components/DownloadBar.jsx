export default function DownloadBar({ selected, onDownload, downloadState, onReset, onOpenFolder }) {
  const { status, done, total, speed, fileLogs, outputDir } = downloadState;
  const pct = total ? Math.round((done / total) * 100) : 0;

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
            {fileLogs.slice(-3).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <span className="text-green-400 text-sm">✅ Done — {done} files downloaded</span>
          <button onClick={() => onOpenFolder(outputDir)} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">Open Folder</button>
          <button onClick={onReset} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm ml-auto">New Harvest</button>
        </div>
      )}
    </div>
  );
}
