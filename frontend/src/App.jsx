import { Component, useEffect, useRef, useState } from "react";
import { getSettings, startScan, startDownload, openFolder } from "./api";
import URLBar from "./components/URLBar";
import ScanProgress from "./components/ScanProgress";
import MediaGrid from "./components/MediaGrid";
import DownloadBar from "./components/DownloadBar";
import HistoryList from "./components/HistoryList";
import SettingsForm from "./components/SettingsForm";
import { toast, ToastHost } from "./toast";

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("UI error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
          <div className="max-w-lg text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-3">Something went wrong</h1>
            <pre className="text-left bg-gray-900 p-3 rounded text-xs text-gray-400 overflow-auto">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [currentUrl, setCurrentUrl] = useState("");

  // Download state
  const [dlState, setDlState] = useState({
    status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "",
    errors: 0, skipped: 0, failedItems: [],
  });

  // Hold cleanup callbacks for active SSE/fetch streams so we can cancel them.
  const scanCleanup = useRef(null);
  const downloadCleanup = useRef(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
    return () => {
      scanCleanup.current?.();
      downloadCleanup.current?.();
    };
  }, []);

  // Global keyboard: Escape resets when idle of complete work; does nothing mid-download.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (scanState === "scanning" && scanCleanup.current) {
          scanCleanup.current();
          scanCleanup.current = null;
          setScanState("idle");
          toast("Scan cancelled", "warn");
        } else if (scanState !== "idle" && dlState.status !== "downloading") {
          reset();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanState, dlState.status]);

  function cancelStreams() {
    scanCleanup.current?.();
    scanCleanup.current = null;
    downloadCleanup.current?.();
    downloadCleanup.current = null;
  }

  function reset() {
    cancelStreams();
    setScanState("idle");
    setLogs([]);
    setCounts({ images: 0, videos: 0 });
    setItems([]);
    setSelected(new Set());
    setDlState({
      status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "",
      errors: 0, skipped: 0, failedItems: [],
    });
    setCurrentUrl("");
    setScreen("home");
  }

  function handleHarvest(url, harvestMode) {
    cancelStreams();
    setMode(harvestMode);
    setCurrentUrl(url);
    setScanState("scanning");
    setLogs([]);
    setCounts({ images: 0, videos: 0 });
    setItems([]);
    setSelected(new Set());
    setDlState({ status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "" });

    const collected = [];

    scanCleanup.current = startScan(url, {
      onStatus: ({ msg }) => setLogs(l => [...l, `🔵 ${msg}`]),
      onFound: (item) => {
        collected.push(item);
        setItems(prev => [...prev, item]);
        setCounts(c => ({
          images: c.images + (item.type === "image" ? 1 : 0),
          videos: c.videos + (item.type === "video" ? 1 : 0),
        }));
        const tail = item.url.split("/").pop().slice(0, 50);
        setLogs(l => [...l, `✅ Found ${item.type}: ${tail}`]);
        if (harvestMode === "auto") {
          setSelected(prev => new Set([...prev, item.url]));
        }
      },
      onDone: ({ scan_id, total_images, total_videos }) => {
        setScanState("done");
        scanCleanup.current = null;
        toast(`Found ${total_images} images and ${total_videos} videos`, "success");
        if (harvestMode === "auto" && collected.length > 0) {
          triggerDownload(
            collected.map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream })),
            scan_id,
            url,
          );
        }
      },
      onError: () => {
        setLogs(l => [...l, "🔴 Scan failed"]);
        setScanState("done");
        scanCleanup.current = null;
        toast("Scan failed — check the URL and try again", "error");
      },
    });
  }

  async function triggerDownload(urlItems, scanId = "", sourceUrl = "") {
    if (urlItems.length === 0) return;
    const s = await getSettings();
    const domain = new URL(sourceUrl || urlItems[0].url).hostname;
    const payload = {
      scan_id: scanId,
      urls: urlItems,
      output_dir: s.output_dir,
      images_subfolder: s.images_subfolder,
      videos_subfolder: s.videos_subfolder,
      per_site_folder: s.per_site_folder === "true",
      site_name: domain,
      source_url: sourceUrl || currentUrl,
    };

    setDlState({
      ...dlState, status: "downloading", total: urlItems.length, outputDir: s.output_dir,
      done: 0, speed: 0, fileLogs: [], errors: 0, skipped: 0, failedItems: [],
    });

    downloadCleanup.current = startDownload(payload, {
      onProgress: ({ done, total, speed_mbps }) =>
        setDlState(d => ({ ...d, done, total, speed: speed_mbps })),
      onFileDone: ({ path, error, attempts, engine }) =>
        setDlState(d => ({
          ...d,
          fileLogs: [
            ...d.fileLogs.slice(-99),
            error
              ? `❌ [${engine} ×${attempts}] ${error}`
              : `✅ ${path?.split("/").pop()}${attempts > 1 ? ` (×${attempts})` : ""}`,
          ],
        })),
      onComplete: ({ downloaded, output_dir, errors, skipped, failed_items }) => {
        setDlState(d => ({
          ...d,
          status: "done",
          done: downloaded,
          outputDir: output_dir,
          errors: errors || 0,
          skipped: skipped || 0,
          failedItems: failed_items || [],
        }));
        downloadCleanup.current = null;
        if (errors > 0) {
          toast(`${downloaded} downloaded, ${errors} failed`, "warn");
        } else {
          toast(`${downloaded} files downloaded`, "success");
        }
      },
      onError: () => {
        setDlState(d => ({ ...d, status: "done" }));
        downloadCleanup.current = null;
      },
    });
  }

  function handleDownloadSelected() {
    const urlItems = items
      .filter(i => selected.has(i.url))
      .map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream }));
    triggerDownload(urlItems, "", currentUrl);
  }

  function handleRetryFailed(failedItems) {
    // Find the original items so we keep their type + is_stream flags.
    const failedUrls = new Set(failedItems.map(f => f.url));
    const retryItems = items
      .filter(i => failedUrls.has(i.url))
      .map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream }));
    if (retryItems.length === 0) return;
    triggerDownload(retryItems, "", currentUrl);
  }

  function toggleItem(url) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }

  return (
    <ErrorBoundary>
      <ToastHost />
      <div className="min-h-screen bg-gray-950 text-white">
        <nav className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
          <button onClick={reset} className="text-xl font-bold text-purple-400 hover:text-purple-300">
            🎣 MediaHarbor
          </button>
          <div className="flex gap-2">
            {["home", "history", "settings"].map(s => (
              <button
                key={s}
                onClick={() => setScreen(s)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${screen === s ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </nav>

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

            {scanState === "done" && mode === "select" && (
              <DownloadBar
                selected={selected}
                onDownload={handleDownloadSelected}
                downloadState={dlState}
                onReset={reset}
                onOpenFolder={openFolder}
                onRetryFailed={handleRetryFailed}
              />
            )}

            {mode === "auto" && dlState.status !== "idle" && (
              <DownloadBar
                selected={selected}
                onDownload={() => {}}
                downloadState={dlState}
                onReset={reset}
                onOpenFolder={openFolder}
                onRetryFailed={handleRetryFailed}
              />
            )}
          </>
        )}

        {screen === "history" && <HistoryList />}
        {screen === "settings" && <SettingsForm />}
      </div>
    </ErrorBoundary>
  );
}
