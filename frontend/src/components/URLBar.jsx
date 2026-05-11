export default function URLBar({ onHarvest, scanning, outputDir, onGoSettings }) {
  function submit(e) {
    e.preventDefault();
    const url = e.target.url.value.trim();
    const mode = e.target.mode.value;
    if (url) onHarvest(url, mode);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-3xl mx-auto px-4 pt-10 pb-4">
      <input
        name="url"
        type="url"
        required
        autoFocus
        disabled={scanning}
        placeholder="Paste any webpage URL..."
        className="w-full px-4 py-4 text-lg bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 text-white placeholder-gray-500 disabled:opacity-50"
      />

      <div className="flex items-center gap-3 mt-3">
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm font-medium">
          {["auto", "select"].map(m => (
            <label key={m} className="cursor-pointer">
              <input type="radio" name="mode" value={m} defaultChecked={m === "auto"} className="sr-only" />
              <span className={`block px-4 py-2 transition-colors ${m === "auto" ? "peer-checked:bg-purple-600" : ""}`}
                style={{}} // controlled via JS below
              >
                {m === "auto" ? "Auto Download" : "Select & Download"}
              </span>
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={scanning}
          className="ml-auto px-8 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-white transition-colors"
        >
          {scanning ? "Scanning..." : "Harvest"}
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
