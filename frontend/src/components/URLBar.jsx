import { useRef, useState } from "react";

const EXAMPLES = [
  { label: "Unsplash", url: "https://unsplash.com/" },
  { label: "Reddit", url: "https://www.reddit.com/r/EarthPorn/" },
  { label: "Imgur", url: "https://imgur.com/gallery/" },
  { label: "Pexels", url: "https://www.pexels.com/videos/" },
];

export default function URLBar({ onHarvest, scanning, outputDir, onGoSettings }) {
  const [mode, setMode] = useState("auto");
  const inputRef = useRef(null);

  function submit(e) {
    e.preventDefault();
    const url = e.target.url.value.trim();
    if (url) onHarvest(url, mode);
  }

  function useExample(url) {
    if (inputRef.current) {
      inputRef.current.value = url;
      inputRef.current.focus();
    }
  }

  function onKeyDown(e) {
    // Ctrl/Cmd + Enter → submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const url = e.target.value.trim();
      if (url) onHarvest(url, mode);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-3xl mx-auto px-4 pt-10 pb-4">
      <div className="relative">
        <input
          ref={inputRef}
          name="url"
          type="url"
          required
          autoFocus
          disabled={scanning}
          onKeyDown={onKeyDown}
          placeholder="Paste any webpage URL..."
          className="w-full pl-12 pr-4 py-4 text-lg bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-white placeholder-gray-500 disabled:opacity-50 transition-all"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none select-none">
          🔗
        </span>
        <kbd className="hidden sm:inline-flex absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-500 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 pointer-events-none">
          ⌘ ↵
        </kbd>
      </div>

      {/* Example chips */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-xs text-gray-600">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => useExample(ex.url)}
            disabled={scanning}
            className="px-2.5 py-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-purple-500 transition-colors disabled:opacity-30"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm font-medium">
          {[
            { value: "auto", label: "Auto Download" },
            { value: "select", label: "Select & Download" },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`px-4 py-2 transition-colors ${
                mode === value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-900 text-gray-400 hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={scanning}
          className="ml-auto px-8 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors shadow-lg shadow-purple-600/20 hover:shadow-purple-600/40"
        >
          {scanning ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Scanning...
            </span>
          ) : (
            "Harvest"
          )}
        </button>
      </div>

      {outputDir && (
        <p className="mt-2 text-xs text-gray-500">
          Saving to{" "}
          <button type="button" onClick={onGoSettings} className="text-purple-400 hover:underline">
            {outputDir}
          </button>
        </p>
      )}
    </form>
  );
}
