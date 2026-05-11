import { useEffect, useState } from "react";
import { getSettings, startScan, startDownload, openFolder } from "./api";
import URLBar from "./components/URLBar";
import ScanProgress from "./components/ScanProgress";
import MediaGrid from "./components/MediaGrid";
import DownloadBar from "./components/DownloadBar";
import HistoryList from "./components/HistoryList";
import SettingsForm from "./components/SettingsForm";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [settings, setSettings] = useState({});

  // Scan state
  const [scanState, setScanState] = useState("idle"); // idle | scanning | done
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({ images: 0, videos: 0 });
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [mode, setMode] = useState("auto");

  // Download state
  const [dlState, setDlState] = useState({
    status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "",
  });

  useEffect(() => { getSettings().then(setSettings); }, []);

  function reset() {
    setScanState("idle");
    setLogs([]);
    setCounts({ images: 0, videos: 0 });
    setItems([]);
    setSelected(new Set());
    setDlState({ status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "" });
    setScreen("home");
  }

  async function handleHarvest(url, harvestMode) {
    setMode(harvestMode);
    setScanState("scanning");
    setLogs([]);
    setCounts({ images: 0, videos: 0 });
    setItems([]);
    setSelected(new Set());
    setDlState({ status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "" });

    const allItems = [];

    startScan(url, {
      onStatus: ({ msg }) => setLogs(l => [...l, `🔵 ${msg}`]),
      onFound: (item) => {
        allItems.push(item);
        setItems(prev => [...prev, item]);
        setCounts(c => ({
          images: c.images + (item.type === "image" ? 1 : 0),
          videos: c.videos + (item.type === "video" ? 1 : 0),
        }));
        setLogs(l => [...l, `✅ Found ${item.type}: ${item.url.split("/").pop().slice(0, 50)}`]);
        if (harvestMode === "auto") {
          setSelected(prev => new Set([...prev, item.url]));
        }
      },
      onDone: ({ scan_id }) => {
        setScanState("done");
        if (harvestMode === "auto") {
          triggerDownload(allItems.map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream })));
        }
      },
      onError: () => setScanState("done"),
    });
  }

  async function triggerDownload(urlItems) {
    const s = await getSettings();
    const domain = urlItems[0] ? new URL(urlItems[0].url).hostname : "";
    const payload = {
      scan_id: "x",
      urls: urlItems,
      output_dir: s.output_dir,
      images_subfolder: s.images_subfolder,
      videos_subfolder: s.videos_subfolder,
      per_site_folder: s.per_site_folder === "true",
      site_name: domain,
    };

    setDlState(d => ({ ...d, status: "downloading", total: urlItems.length, outputDir: s.output_dir }));

    await startDownload(payload, {
      onProgress: ({ done, total, speed_mbps }) =>
        setDlState(d => ({ ...d, done, total, speed: speed_mbps })),
      onFileDone: ({ path, error }) =>
        setDlState(d => ({
          ...d,
          fileLogs: [...d.fileLogs, error ? `❌ ${error}` : `✅ ${path?.split("/").pop()}`],
        })),
      onComplete: ({ downloaded, output_dir }) =>
        setDlState(d => ({ ...d, status: "done", done: downloaded, outputDir: output_dir })),
    });
  }

  function handleDownloadSelected() {
    const urlItems = items
      .filter(i => selected.has(i.url))
      .map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream }));
    triggerDownload(urlItems);
  }

  function toggleItem(url) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <button onClick={reset} className="text-xl font-bold text-purple-400 hover:text-purple-300">
          🎣 MediaHarbor
        </button>
        <div className="flex gap-2">
          {["home", "history", "settings"].map(s => (
            <button key={s} onClick={() => setScreen(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${screen === s ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* Home */}
      {screen === "home" && (
        <>
          <URLBar
            onHarvest={handleHarvest}
            scanning={scanState === "scanning"}
            outputDir={settings.output_dir}
            onGoSettings={() => setScreen("settings")}
          />

          {scanState !== "idle" && (
            <ScanProgress logs={logs} counts={counts} done={scanState === "done"} />
          )}

          {scanState === "done" && mode === "select" && items.length > 0 && (
            <MediaGrid
              items={items}
              selected={selected}
              onToggle={toggleItem}
              onSelectAll={() => setSelected(new Set(items.map(i => i.url)))}
              onSelectNone={() => setSelected(new Set())}
            />
          )}

          {(scanState === "done" && mode === "select") && (
            <DownloadBar
              selected={selected}
              onDownload={handleDownloadSelected}
              downloadState={dlState}
              onReset={reset}
              onOpenFolder={openFolder}
            />
          )}

          {mode === "auto" && dlState.status !== "idle" && (
            <DownloadBar
              selected={selected}
              onDownload={() => {}}
              downloadState={dlState}
              onReset={reset}
              onOpenFolder={openFolder}
            />
          )}
        </>
      )}

      {screen === "history" && <HistoryList />}
      {screen === "settings" && <SettingsForm />}
    </div>
  );
}
