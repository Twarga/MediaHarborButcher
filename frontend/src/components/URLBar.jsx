import { useRef, useState } from "react";
import { IconLink, IconSparkles, IconArrowRight } from "../icons";

const EXAMPLES = [
  { label: "Unsplash",  url: "https://unsplash.com/" },
  { label: "Reddit",    url: "https://www.reddit.com/r/EarthPorn/" },
  { label: "Vimeo",     url: "https://vimeo.com/" },
  { label: "Pexels",    url: "https://www.pexels.com/videos/" },
];

const ORDERED_HOSTS = ["imgchest.com", "imagechest.com"];
function detectOrdered(val) {
  if (!val) return false;
  try {
    const host = new URL(val).hostname.toLowerCase().replace(/^www\./, "");
    return ORDERED_HOSTS.some(h => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export default function URLBar({ onHarvest, scanning, outputDir, onGoSettings }) {
  const [mode, setMode] = useState("auto");
  const [ordered, setOrdered] = useState(false);
  const inputRef = useRef(null);

  function submit(e) {
    e.preventDefault();
    const url = e.target.url.value.trim();
    if (url) onHarvest(url, mode);
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const url = e.target.value.trim();
      if (url) onHarvest(url, mode);
    }
  }

  function onChange(e) {
    setOrdered(detectOrdered(e.target.value));
  }

  function useExample(url) {
    if (inputRef.current) {
      inputRef.current.value = url;
      inputRef.current.focus();
      setOrdered(detectOrdered(url));
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-3xl mx-auto anim-fade-up">
      <div className="card p-1.5 shadow-2xl shadow-amber-500/5">
        <div className="flex items-center gap-2">
          <span className="pl-4 pr-1 text-paper-400"><IconLink size={18} /></span>
          <input
            ref={inputRef}
            name="url"
            type="url"
            required
            autoFocus
            disabled={scanning}
            onKeyDown={onKeyDown}
            onChange={onChange}
            placeholder="https://…"
            className="flex-1 bg-transparent py-3.5 text-lg text-paper-100 placeholder-paper-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:bg-ink-500 disabled:text-paper-500 disabled:cursor-not-allowed text-ink-900 font-semibold rounded-lg transition-colors"
          >
            {scanning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-ink-900/40 border-t-ink-900 rounded-full animate-spin" />
                Scanning
              </>
            ) : (
              <>
                <IconSparkles size={16} strokeWidth={2.25} />
                Harvest
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mode toggle + examples + shortcuts */}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <div className="inline-flex rounded-lg overflow-hidden border border-ink-400 bg-ink-700 text-sm p-0.5">
          {[
            { value: "auto", label: "Auto" },
            { value: "select", label: "Select" },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`px-4 py-1.5 rounded-md transition-colors font-medium
                ${mode === value
                  ? "bg-amber-400 text-ink-900"
                  : "text-paper-300 hover:text-paper-100"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-paper-500 font-mono">try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => useExample(ex.url)}
              disabled={scanning}
              className="px-2.5 py-1 text-xs rounded-md border border-ink-400 text-paper-400 hover:text-amber-300 hover:border-amber-400/40 transition-colors disabled:opacity-30"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {outputDir && (
        <p className="mt-4 text-xs text-paper-500 flex items-center gap-1.5">
          <span>Saving to</span>
          <button
            type="button"
            onClick={onGoSettings}
            className="text-amber-300 hover:text-amber-200 font-mono underline-offset-2 hover:underline inline-flex items-center gap-1"
          >
            {outputDir}
            <IconArrowRight size={11} />
          </button>
          {ordered && (
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 font-mono text-[10px] uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-amber-400" />
              Ordered · files numbered 001, 002 …
            </span>
          )}
          <span className="ml-auto text-paper-600 font-mono text-[10px]">⌘↵</span>
        </p>
      )}
    </form>
  );
}
