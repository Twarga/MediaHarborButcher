export default function MediaCard({ item, selected, onToggle }) {
  return (
    <div
      onClick={() => onToggle(item.url)}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
        selected ? "border-purple-500" : "border-transparent hover:border-gray-600"
      }`}
    >
      {item.type === "image" ? (
        <img
          src={item.url}
          alt=""
          loading="lazy"
          className="w-full h-36 object-cover bg-gray-800"
          onError={e => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className="w-full h-36 bg-gray-800 flex items-center justify-center border border-purple-900">
          <span className="text-4xl">▶</span>
        </div>
      )}

      {/* ext badge */}
      <span className="absolute bottom-1 left-1 bg-black/70 text-xs px-1.5 py-0.5 rounded text-gray-300">
        {item.ext || item.type}
      </span>

      {/* checkbox */}
      <span className={`absolute top-1 right-1 w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
        selected ? "bg-purple-600 border-purple-600 text-white" : "bg-black/50 border-gray-400"
      }`}>
        {selected && "✓"}
      </span>
    </div>
  );
}
