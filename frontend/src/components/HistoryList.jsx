import { useEffect, useState } from "react";
import { getHistory, deleteHistory, openFolder } from "../api";

export default function HistoryList() {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getHistory();
    setHistory(data.history || []);
  }

  async function del(id) {
    await deleteHistory(id);
    setHistory(h => h.filter(x => x.id !== id));
  }

  const filtered = history.filter(h =>
    h.url.toLowerCase().includes(search.toLowerCase()) ||
    (h.domain || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by URL or domain..."
        className="w-full px-4 py-2 mb-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
      />

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No harvests yet</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(h => (
            <div key={h.id} className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl border border-gray-700">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{h.domain || h.url}</p>
                <p className="text-xs text-gray-500 truncate">{h.url}</p>
                <p className="text-xs text-gray-600 mt-0.5">{h.created_at}</p>
              </div>
              <div className="text-right text-sm shrink-0">
                <p className="text-purple-400">{h.image_count} img · {h.video_count} vid</p>
                <p className="text-gray-500">{h.total_size_mb} MB</p>
              </div>
              <button onClick={() => openFolder(h.output_dir)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">📂</button>
              <button onClick={() => del(h.id)} className="px-3 py-1 bg-red-900/50 hover:bg-red-800 rounded text-xs text-red-400">🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
