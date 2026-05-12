import { IconCheck, IconPlay, IconImage, IconVideo } from "../icons";

export default function MediaCard({ item, selected, onToggle }) {
  const isImage = item.type === "image";
  const thumb = isImage ? item.url : item.poster;

  return (
    <button
      onClick={() => onToggle(item.url)}
      title={item.url}
      className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-150 text-left
        ${selected
          ? "border-amber-400 shadow-glow-amber"
          : "border-ink-500 hover:border-ink-300"}`}
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="w-full aspect-[4/3] object-cover bg-ink-600"
          onError={(e) => {
            const parent = e.target.parentElement;
            e.target.remove();
            const ph = document.createElement("div");
            ph.className = "w-full aspect-[4/3] bg-ink-600 flex items-center justify-center text-paper-600";
            ph.innerHTML = isImage
              ? '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5a2 2 0 0 0-2.83 0L5 21"/></svg>'
              : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4V8Z"/></svg>';
            parent.insertBefore(ph, parent.firstChild);
          }}
        />
      ) : (
        <div className="w-full aspect-[4/3] bg-ink-600 flex items-center justify-center">
          {isImage ? <IconImage size={32} className="text-paper-600" /> : <IconVideo size={32} className="text-paper-600" />}
        </div>
      )}

      {/* Video play overlay */}
      {!isImage && thumb && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-12 h-12 rounded-full bg-ink-900/70 backdrop-blur-sm flex items-center justify-center text-paper-100 shadow-lg">
            <IconPlay size={18} strokeWidth={2} />
          </span>
        </div>
      )}

      {/* Gradient shade at bottom for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900/90 to-transparent pointer-events-none" />

      {/* Bottom-left: ext + dimensions */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-1.5 py-0.5 rounded bg-ink-900/80 text-paper-200 uppercase">
          {(item.ext || item.type).replace(".", "")}
        </span>
        {isImage && item.width > 0 && item.height > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-ink-900/60 text-paper-400">
            {item.width}×{item.height}
          </span>
        )}
        {item.is_stream && (
          <span className="px-1.5 py-0.5 rounded bg-coral-500/80 text-paper-50">HLS</span>
        )}
      </div>

      {/* Checkbox */}
      <div
        className={`absolute top-2 right-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors
          ${selected
            ? "bg-amber-400 border-amber-400 text-ink-900"
            : "bg-ink-900/70 border-paper-400/50 text-transparent group-hover:border-paper-300"}`}
      >
        <IconCheck size={14} strokeWidth={3} />
      </div>
    </button>
  );
}
