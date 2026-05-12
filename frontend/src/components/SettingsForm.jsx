import { useEffect, useState } from "react";
import { getSettings, saveSettings, clearHistory } from "../api";
import { toast } from "../toast";
import { IconFolder, IconImage, IconShield, IconTrash, IconCheck } from "../icons";

const FORMATS = ["jpg", "png", "webp", "gif", "mp4", "webm"];

export default function SettingsForm() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { getSettings().then(setS); }, []);

  if (!s) return <div className="max-w-3xl mx-auto px-6 py-12 text-paper-500 text-center">Loading…</div>;

  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  const toggleFormat = (f) => {
    const cur = s.allowed_formats ? s.allowed_formats.split(",").filter(Boolean) : [];
    const next = cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f];
    set("allowed_formats", next.join(","));
  };

  async function submit(e) {
    e.preventDefault();
    await saveSettings(s);
    setSaved(true);
    toast("Settings saved", "success");
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClearHistory() {
    if (!confirm("Delete ALL harvest history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await clearHistory();
      toast("History cleared", "success");
    } catch (err) {
      toast(`Failed: ${err.message}`, "error");
    } finally {
      setClearing(false);
    }
  }

  const inputCls = "w-full px-3 py-2 bg-ink-700 border border-ink-400 rounded-lg text-paper-100 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all";

  const Toggle = ({ k }) => (
    <button
      type="button"
      onClick={() => set(k, s[k] === "true" ? "false" : "true")}
      className={`relative w-11 h-6 rounded-full transition-colors ${s[k] === "true" ? "bg-amber-400" : "bg-ink-500"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 block w-5 h-5 bg-paper-50 rounded-full shadow transition-transform ${s[k] === "true" ? "translate-x-5" : ""}`}
      />
    </button>
  );

  const Slider = ({ k, min, max, step = 1, label }) => (
    <div>
      <div className="flex justify-between text-xs text-paper-500 mb-1.5 font-mono">
        <span className="uppercase tracking-wide">{label}</span>
        <span className="text-amber-300">{s[k]}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={s[k]}
        onChange={(e) => set(k, e.target.value)}
        className="w-full accent-amber-400"
      />
    </div>
  );

  const Row = ({ label, children }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-paper-300">{label}</span>
      {children}
    </div>
  );

  const Section = ({ icon: Ic, title, children }) => (
    <section className="card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-amber-300"><Ic size={16} /></span>
        <h2 className="font-display italic text-2xl text-paper-100">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display text-5xl mb-1">Settings</h1>
      <p className="text-paper-400 mb-8">Configure downloads, filters, and browser behavior.</p>

      <form onSubmit={submit} className="space-y-5">
        <Section icon={IconFolder} title="Download location">
          <div>
            <label className="block text-xs text-paper-500 mb-1.5 font-mono uppercase tracking-wide">Output folder</label>
            <input className={inputCls} value={s.output_dir} onChange={(e) => set("output_dir", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-paper-500 mb-1.5 font-mono uppercase tracking-wide">Images subfolder</label>
              <input className={inputCls} value={s.images_subfolder} onChange={(e) => set("images_subfolder", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-paper-500 mb-1.5 font-mono uppercase tracking-wide">Videos subfolder</label>
              <input className={inputCls} value={s.videos_subfolder} onChange={(e) => set("videos_subfolder", e.target.value)} />
            </div>
          </div>
          <Row label="Per-site subfolder"><Toggle k="per_site_folder" /></Row>
        </Section>

        <Section icon={IconImage} title="What to download">
          <Row label="Include images"><Toggle k="include_images" /></Row>
          <Row label="Include videos"><Toggle k="include_videos" /></Row>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-paper-500 mb-1.5 font-mono uppercase tracking-wide">Min width (px)</label>
              <input type="number" min="0" className={inputCls} value={s.min_image_width} onChange={(e) => set("min_image_width", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-paper-500 mb-1.5 font-mono uppercase tracking-wide">Min height (px)</label>
              <input type="number" min="0" className={inputCls} value={s.min_image_height} onChange={(e) => set("min_image_height", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-paper-500 mb-2 font-mono uppercase tracking-wide">
              Allowed formats <span className="normal-case text-paper-600">(empty = all)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => {
                const active = (s.allowed_formats || "").split(",").includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFormat(f)}
                    className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors
                      ${active
                        ? "bg-amber-400 border-amber-400 text-ink-900"
                        : "border-ink-400 text-paper-400 hover:border-amber-400/40 hover:text-amber-300"}`}
                  >
                    .{f}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section icon={IconShield} title="Browser & speed">
          <Row label="Stealth mode"><Toggle k="stealth_mode" /></Row>
          <Slider k="max_scrolls" min={1} max={50} label="Max scroll depth" />
          <Slider k="scroll_delay" min={0.5} max={5} step={0.5} label="Scroll delay (s)" />
          <Slider k="concurrent_downloads" min={1} max={10} label="Concurrent downloads" />
        </Section>

        <button
          type="submit"
          className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-ink-900 font-semibold rounded-xl transition-colors shadow-glow-amber inline-flex items-center justify-center gap-2"
        >
          {saved ? <><IconCheck size={16} strokeWidth={2.5} /> Saved</> : "Save settings"}
        </button>

        <section className="card p-5 border-coral-600/30">
          <div className="flex items-center gap-2.5 mb-1">
            <IconTrash size={14} className="text-coral-400" />
            <h3 className="text-sm font-semibold text-coral-300">Danger zone</h3>
          </div>
          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="text-sm text-paper-400">
              <p className="text-paper-200 font-medium">Clear all history</p>
              <p className="text-xs">Removes every row from the harvests table. Files on disk are not touched.</p>
            </div>
            <button
              type="button"
              disabled={clearing}
              onClick={handleClearHistory}
              className="px-4 py-2 bg-coral-500/20 hover:bg-coral-500/30 border border-coral-500/40 text-coral-300 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {clearing ? "Clearing…" : "Clear"}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
