import { useEffect, useState } from "react";
import { getHistory, deleteHistory, openFolder } from "../api";
import { toast } from "../toast";

function formatDate(raw) {
  if (!raw) return "";
  // SQLite's CURRENT_TIMESTAMP returns UTC as "YYYY-MM-DD HH:MM:SS"; add Z so
  // the Date constructor treats it as UTC instead of local time.
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return raw;

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function HistoryList() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getHistory();
      setHistory(data.history || []);
    } finally {
      setLoading(false);
    }
  }

  async function del(id) {
    await deleteHistory(id);
    setHistory(h => h.filter(x => x.id !== id));
  }

  const q = search.toLowerCase();
  const filtered = history.filter(h =>
    (h.url || "").toLowerCase().includes(q) ||
    (h.domain || "").toLowerCase().includes(q)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by URL or domain..."
        className="w-full px-4 py-2 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
      />

      {loading ? (
        <p className="text-gray-500 text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4 opacity-30">📋</div>
          <p className="text-gray-400 font-medium mb-1">
            {search ? "No matches" : "No harvests yet"}
          </p>
          <p className="text-gray-600 text-sm">
            {search ? "Try a different search term." : "Paste a URL on the Home screen to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(h => (
            <div key={h.id} className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl border border-gray-700">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{h.domain || h.url}</p>
                <p className="text-xs text-gray-500 truncate">{h.url}</p>
                <p className="text-xs text-gray-600 mt-0.5" title={h.created_at}>
                  {formatDate(h.created_at)}
                </p>
              </div>
              <div className="text-right text-sm shrink-0">
                <p className="text-purple-400">{h.image_count} img · {h.video_count} vid</p>
                <p className="text-gray-500">{h.total_size_mb} MB</p>
              </div>
              <button
                onClick={() => openFolder(h.output_dir).catch(err => toast(err.message, "error"))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                title="Open folder"
              >
                📂
              </button>
              <button
                onClick={() => del(h.id)}
                className="px-3 py-1 bg-red-900/50 hover:bg-red-800 rounded text-xs text-red-400"
                title="Delete entry"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
