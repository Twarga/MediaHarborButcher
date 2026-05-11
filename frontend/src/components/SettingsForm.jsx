import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "../api";

const FORMATS = ["jpg", "png", "webp", "gif", "mp4", "webm"];

export default function SettingsForm() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSettings().then(setS); }, []);

  if (!s) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  const set = (k, v) => setS(prev => ({ ...prev, [k]: v }));

  const toggleFormat = (f) => {
    const cur = s.allowed_formats ? s.allowed_formats.split(",").filter(Boolean) : [];
    const next = cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f];
    set("allowed_formats", next.join(","));
  };

  async function submit(e) {
    e.preventDefault();
    await saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const label = "block text-sm text-gray-400 mb-1";
  const input = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500";
  const toggle = (val) => (
    <button type="button" onClick={() => set} className={`w-12 h-6 rounded-full transition-colors ${val === "true" ? "bg-purple-600" : "bg-gray-700"}`}>
      <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${val === "true" ? "translate-x-6" : ""}`} />
    </button>
  );

  const Toggle = ({ k }) => (
    <button
      type="button"
      onClick={() => set(k, s[k] === "true" ? "false" : "true")}
      className={`w-12 h-6 rounded-full transition-colors ${s[k] === "true" ? "bg-purple-600" : "bg-gray-700"}`}
    >
      <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${s[k] === "true" ? "translate-x-6" : ""}`} />
    </button>
  );

  const Slider = ({ k, min, max, step = 1, label: lbl }) => (
    <div>
      <div className="flex justify-between text-sm text-gray-400 mb-1"><span>{lbl}</span><span className="text-white">{s[k]}</span></div>
      <input type="range" min={min} max={max} step={step} value={s[k]} onChange={e => set(k, e.target.value)}
        className="w-full accent-purple-600" />
    </div>
  );

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto px-4 py-6 space-y-8">

      <section>
        <h2 className="text-lg font-semibold mb-4 text-purple-400">Download Location</h2>
        <div className="space-y-3">
          <div><label className={label}>Output folder</label><input className={input} value={s.output_dir} onChange={e => set("output_dir", e.target.value)} /></div>
          <div><label className={label}>Images subfolder</label><input className={input} value={s.images_subfolder} onChange={e => set("images_subfolder", e.target.value)} /></div>
          <div><label className={label}>Videos subfolder</label><input className={input} value={s.videos_subfolder} onChange={e => set("videos_subfolder", e.target.value)} /></div>
          <div className="flex items-center justify-between"><span className={label + " mb-0"}>Per-site subfolder</span><Toggle k="per_site_folder" /></div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-purple-400">What to Download</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><span className={label + " mb-0"}>Include images</span><Toggle k="include_images" /></div>
          <div className="flex items-center justify-between"><span className={label + " mb-0"}>Include videos</span><Toggle k="include_videos" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Min image width (px)</label><input type="number" className={input} value={s.min_image_width} onChange={e => set("min_image_width", e.target.value)} /></div>
            <div><label className={label}>Min image height (px)</label><input type="number" className={input} value={s.min_image_height} onChange={e => set("min_image_height", e.target.value)} /></div>
          </div>
          <div>
            <label className={label}>Allowed formats <span className="text-gray-600">(empty = all)</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {FORMATS.map(f => {
                const active = (s.allowed_formats || "").split(",").includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFormat(f)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${active ? "bg-purple-600 border-purple-600 text-white" : "border-gray-600 text-gray-400 hover:border-gray-400"}`}>
                    .{f}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-purple-400">Browser & Speed</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between"><span className={label + " mb-0"}>Stealth mode</span><Toggle k="stealth_mode" /></div>
          <Slider k="max_scrolls" min={1} max={50} lbl="Max scroll depth" />
          <Slider k="scroll_delay" min={0.5} max={5} step={0.5} lbl="Scroll delay (s)" />
          <Slider k="concurrent_downloads" min={1} max={10} lbl="Concurrent downloads" />
        </div>
      </section>

      <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold text-white transition-colors">
        {saved ? "Saved ✓" : "Save Settings"}
      </button>
    </form>
  );
}
