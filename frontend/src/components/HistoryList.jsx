import { useEffect, useState } from "react";
import { getHistory, deleteHistory, openFolder } from "../api";
import { toast } from "../toast";
import { IconSearch, IconFolderOpen, IconTrash, IconClock, IconHistory } from "../icons";

function formatDate(raw) {
  if (!raw) return "";
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return raw;
  const diff = Math.round((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.round(diff / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Stable color per domain, derived from a hash
function domainColor(domain) {
  const colors = ["#ff8a3d", "#ef4852", "#14b8a6", "#9b5de5", "#f15bb5", "#fee440"];
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
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
    setHistory((h) => h.filter((x) => x.id !== id));
  }

  const q = search.toLowerCase();
  const filtered = history.filter((h) =>
    (h.url || "").toLowerCase().includes(q) ||
    (h.domain || "").toLowerCase().includes(q)
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-5xl">History</h1>
          <p className="text-paper-400 text-sm mt-1">
            {history.length} harvest{history.length === 1 ? "" : "s"} saved locally
          </p>
        </div>
      </div>

      <div className="card p-1.5 mb-5 flex items-center gap-2">
        <span className="pl-3 text-paper-500"><IconSearch size={16} /></span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by URL or domain…"
          className="flex-1 bg-transparent py-2.5 text-paper-100 placeholder-paper-500 focus:outline-none"
        />
      </div>

      {loading ? (
        <p className="text-paper-500 text-center py-16">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <IconHistory size={32} className="text-paper-600 mx-auto mb-3" />
          <p className="font-display italic text-2xl text-paper-300">
            {search ? "No matches" : "No harvests yet"}
          </p>
          <p className="text-paper-500 text-sm mt-1">
            {search ? "Try a different search term." : "Paste a URL on the home screen to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => (
            <div key={h.id} className="card card-hover p-4 flex items-center gap-4">
              {/* domain avatar */}
              <div
                className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-semibold text-ink-900"
                style={{ background: domainColor(h.domain || h.url) }}
              >
                {(h.domain || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-paper-100 truncate">{h.domain || h.url}</p>
                <p className="text-xs text-paper-500 truncate font-mono">{h.url}</p>
                <p className="text-xs text-paper-600 mt-1 flex items-center gap-1.5" title={h.created_at}>
                  <IconClock size={11} /> {formatDate(h.created_at)}
                </p>
              </div>
              <div className="text-right text-sm shrink-0 hidden sm:block">
                <p className="text-amber-300 font-mono text-xs">
                  {h.image_count} img · {h.video_count} vid
                </p>
                <p className="text-paper-500 font-mono text-xs">{h.total_size_mb} MB</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openFolder(h.output_dir).catch((err) => toast(err.message, "error"))}
                  className="w-9 h-9 rounded-lg bg-ink-700 hover:bg-ink-500 text-paper-300 hover:text-amber-300 flex items-center justify-center transition-colors"
                  title="Open folder"
                >
                  <IconFolderOpen size={15} />
                </button>
                <button
                  onClick={() => del(h.id)}
                  className="w-9 h-9 rounded-lg bg-ink-700 hover:bg-coral-500/20 text-paper-300 hover:text-coral-400 flex items-center justify-center transition-colors"
                  title="Delete entry"
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
