export default function MediaCard({ item, selected, onToggle }) {
  const isImage = item.type === "image";
  const hasThumb = isImage || item.poster;
  const thumbUrl = isImage ? item.url : item.poster;

  return (
    <div
      onClick={() => onToggle(item.url)}
      title={item.url}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-[1.02] ${
        selected ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-transparent hover:border-gray-600"
      }`}
    >
      {hasThumb ? (
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          className="w-full h-36 object-cover bg-gray-800"
          onError={(e) => {
            e.target.replaceWith(
              Object.assign(document.createElement("div"), {
                className: "w-full h-36 bg-gray-800 flex items-center justify-center text-3xl text-gray-600",
                textContent: isImage ? "🖼" : "▶",
              })
            );
          }}
        />
      ) : (
        <div className="w-full h-36 bg-gray-800 flex items-center justify-center border border-purple-900">
          <span className="text-4xl">▶</span>
        </div>
      )}

      {!isImage && hasThumb && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-5xl text-white/80 drop-shadow-lg">▶</span>
        </div>
      )}

      {/* ext badge */}
      <span className="absolute bottom-1 left-1 bg-black/70 text-xs px-1.5 py-0.5 rounded text-gray-300">
        {item.ext || item.type}
      </span>

      {/* dimension badge (images only) */}
      {isImage && item.width > 0 && item.height > 0 && (
        <span className="absolute bottom-1 right-1 bg-black/70 text-[10px] px-1.5 py-0.5 rounded text-gray-400">
          {item.width}×{item.height}
        </span>
      )}

      {/* checkbox */}
      <span className={`absolute top-1 right-1 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
        selected ? "bg-purple-600 border-purple-600 text-white" : "bg-black/50 border-gray-400"
      }`}>
        {selected && "✓"}
      </span>
    </div>
  );
}
