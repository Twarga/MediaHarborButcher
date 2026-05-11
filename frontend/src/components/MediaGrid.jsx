import { useState } from "react";
import MediaCard from "./MediaCard";

export default function MediaGrid({ items, selected, onToggle, onSelectAll, onSelectNone }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilter, setShowFilter] = useState("all");

  const visible = items.filter(item => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (showFilter === "selected" && !selected.has(item.url)) return false;
    if (showFilter === "unselected" && selected.has(item.url)) return false;
    return true;
  });

  const btn = "px-3 py-1 rounded text-sm font-medium transition-colors";
  const active = "bg-purple-600 text-white";
  const inactive = "bg-gray-800 text-gray-400 hover:bg-gray-700";

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-32">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <button className={btn + " " + inactive} onClick={onSelectAll}>Select All</button>
        <button className={btn + " " + inactive} onClick={onSelectNone}>Select None</button>
        <button className={`${btn} ${typeFilter === "image" ? active : inactive}`} onClick={() => setTypeFilter(t => t === "image" ? "all" : "image")}>Images</button>
        <button className={`${btn} ${typeFilter === "video" ? active : inactive}`} onClick={() => setTypeFilter(t => t === "video" ? "all" : "video")}>Videos</button>

        <div className="ml-auto flex gap-2">
          {["all", "selected", "unselected"].map(f => (
            <button key={f} className={`${btn} ${showFilter === f ? active : inactive}`} onClick={() => setShowFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">Showing {visible.length} of {items.length}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {visible.map(item => (
          <MediaCard key={item.url} item={item} selected={selected.has(item.url)} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
