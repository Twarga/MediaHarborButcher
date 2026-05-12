import { useState } from "react";
import MediaCard from "./MediaCard";
import { IconFilter, IconImage, IconVideo, IconCheck, IconX } from "../icons";

export default function MediaGrid({ items, selected, onToggle, onSelectAll, onSelectNone }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilter, setShowFilter] = useState("all");

  const visible = items.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (showFilter === "selected" && !selected.has(item.url)) return false;
    if (showFilter === "unselected" && selected.has(item.url)) return false;
    return true;
  });

  const Chip = ({ active, onClick, children, icon: Ic }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
        ${active
          ? "bg-amber-400 border-amber-400 text-ink-900"
          : "bg-ink-700 border-ink-400 text-paper-300 hover:border-ink-300 hover:text-paper-100"}`}
    >
      {Ic && <Ic size={13} strokeWidth={2.25} />}
      {children}
    </button>
  );

  return (
    <section className="max-w-6xl mx-auto mt-8 pb-32 anim-fade-up">
      {/* Toolbar */}
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <Chip active={false} onClick={onSelectAll} icon={IconCheck}>All</Chip>
        <Chip active={false} onClick={onSelectNone} icon={IconX}>None</Chip>

        <div className="w-px h-6 bg-ink-400 mx-1" />

        <Chip
          active={typeFilter === "image"}
          onClick={() => setTypeFilter(t => t === "image" ? "all" : "image")}
          icon={IconImage}
        >
          Images
        </Chip>
        <Chip
          active={typeFilter === "video"}
          onClick={() => setTypeFilter(t => t === "video" ? "all" : "video")}
          icon={IconVideo}
        >
          Videos
        </Chip>

        <div className="ml-auto flex items-center gap-2 text-xs text-paper-500">
          <IconFilter size={13} className="text-paper-600" />
          {["all", "selected", "unselected"].map((f) => (
            <button
              key={f}
              onClick={() => setShowFilter(f)}
              className={`px-2 py-1 rounded transition-colors ${
                showFilter === f ? "bg-ink-500 text-paper-100" : "hover:text-paper-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-paper-500 font-mono mb-3 px-1">
        showing {visible.length} of {items.length} · {selected.size} selected
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {visible.map((item) => (
          <MediaCard
            key={item.url}
            item={item}
            selected={selected.has(item.url)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}
