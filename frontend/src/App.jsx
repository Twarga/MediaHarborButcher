import { Component, useEffect, useRef, useState } from "react";
import { getSettings, startScan, startDownload, openFolder } from "./api";
import URLBar from "./components/URLBar";
import ScanProgress from "./components/ScanProgress";
import MediaGrid from "./components/MediaGrid";
import DownloadBar from "./components/DownloadBar";
import HistoryList from "./components/HistoryList";
import SettingsForm from "./components/SettingsForm";
import { toast, ToastHost } from "./toast";
import { IconAnchor, IconHome, IconHistory, IconSettings, IconAlert } from "./icons";

// Hosts that trigger ordered (sequential) harvesting — private to this user.
// Imagechest galleries (WhatsApp story screenshots, etc.) must keep their
// original order, so we number filenames 001_, 002_, …
const ORDERED_HOSTS = ["imgchest.com", "imagechest.com"];
function isOrderedHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return ORDERED_HOSTS.some(h => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("UI error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="card max-w-lg p-8 text-center">
            <IconAlert size={40} className="text-coral-400 mx-auto mb-4" />
            <h1 className="font-display text-3xl italic text-paper-100 mb-2">Something broke</h1>
            <pre className="text-left bg-ink-900 p-3 rounded-lg text-xs text-paper-400 overflow-auto font-mono mb-4">
              {String(this.state.error?.stack || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-ink-900 font-semibold rounded-lg"
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
  const [scanState, setScanState] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({ images: 0, videos: 0 });
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [mode, setMode] = useState("auto");
  const [currentUrl, setCurrentUrl] = useState("");
  const [dlState, setDlState] = useState({
    status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "",
    errors: 0, skipped: 0, failedItems: [],
  });

  const scanCleanup = useRef(null);
  const downloadCleanup = useRef(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
    return () => {
      scanCleanup.current?.();
      downloadCleanup.current?.();
    };
  }, []);

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
    setDlState({ status: "idle", done: 0, total: 0, speed: 0, fileLogs: [], outputDir: "", errors: 0, skipped: 0, failedItems: [] });

    const ordered = isOrderedHost(url);

    const collected = [];
    scanCleanup.current = startScan(url, {
      ordered,
      onStatus: ({ msg }) => setLogs(l => [...l, { kind: "info", msg }]),
      onFound: (item) => {
        collected.push(item);
        setItems(prev => [...prev, item]);
        setCounts(c => ({
          images: c.images + (item.type === "image" ? 1 : 0),
          videos: c.videos + (item.type === "video" ? 1 : 0),
        }));
        const tail = item.url.split("/").pop().slice(0, 50);
        const prefix = item.index >= 0 ? `#${String(item.index + 1).padStart(3, "0")} ` : "";
        setLogs(l => [...l, { kind: "ok", msg: `${prefix}${item.type} · ${tail}` }]);
        if (harvestMode === "auto") {
          setSelected(prev => new Set([...prev, item.url]));
        }
      },
      onDone: ({ scan_id, total_images, total_videos }) => {
        setScanState("done");
        scanCleanup.current = null;
        if (ordered) {
          toast(`Ordered scan found ${total_images} images`, "success");
        } else {
          toast(`Found ${total_images} images and ${total_videos} videos`, "success");
        }
        if (harvestMode === "auto" && collected.length > 0) {
          triggerDownload(
            collected.map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream, index: i.index ?? -1 })),
            scan_id, url,
          );
        }
      },
      onError: () => {
        setLogs(l => [...l, { kind: "err", msg: "Scan failed" }]);
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
      scan_id: scanId, urls: urlItems, output_dir: s.output_dir,
      images_subfolder: s.images_subfolder, videos_subfolder: s.videos_subfolder,
      per_site_folder: s.per_site_folder === "true",
      site_name: domain, source_url: sourceUrl || currentUrl,
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
              ? { kind: "err", msg: `[${engine} ×${attempts}] ${error}` }
              : { kind: "ok",  msg: `${path?.split("/").pop()}${attempts > 1 ? ` (×${attempts})` : ""}` },
          ],
        })),
      onComplete: ({ downloaded, output_dir, errors, skipped, failed_items }) => {
        setDlState(d => ({
          ...d, status: "done", done: downloaded, outputDir: output_dir,
          errors: errors || 0, skipped: skipped || 0, failedItems: failed_items || [],
        }));
        downloadCleanup.current = null;
        if (errors > 0) toast(`${downloaded} downloaded, ${errors} failed`, "warn");
        else toast(`${downloaded} files downloaded`, "success");
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
      .map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream, index: i.index ?? -1 }));
    triggerDownload(urlItems, "", currentUrl);
  }

  function handleRetryFailed(failedItems) {
    const failedUrls = new Set(failedItems.map(f => f.url));
    const retryItems = items.filter(i => failedUrls.has(i.url))
      .map(i => ({ url: i.url, type: i.type, is_stream: i.is_stream, index: i.index ?? -1 }));
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

  const NAV_ITEMS = [
    { id: "home", label: "Harvest", icon: IconHome },
    { id: "history", label: "History", icon: IconHistory },
    { id: "settings", label: "Settings", icon: IconSettings },
  ];

  return (
    <ErrorBoundary>
      <ToastHost />
      <div className="min-h-screen text-paper-100">
        {/* Navbar */}
        <nav className="sticky top-0 z-40 backdrop-blur-md bg-ink-900/80 border-b border-ink-500">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <button
              onClick={reset}
              className="group flex items-center gap-2.5 text-paper-100"
            >
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-coral-500 flex items-center justify-center text-ink-900 shadow-glow-amber">
                <IconAnchor size={18} strokeWidth={2.5} />
              </span>
              <span className="font-display text-xl italic tracking-tight">MediaHarbor</span>
            </button>

            <div className="flex items-center gap-1">
              {NAV_ITEMS.map(({ id, label, icon: Ic }) => (
                <button
                  key={id}
                  onClick={() => setScreen(id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${screen === id
                      ? "bg-ink-700 text-paper-100"
                      : "text-paper-400 hover:text-paper-100 hover:bg-ink-700/50"}`}
                >
                  <Ic size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Screens */}
        {screen === "home" && (
          <main className="max-w-5xl mx-auto px-6">
            {scanState === "idle" && (
              <section className="text-center pt-20 pb-8 anim-fade-up">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-300 text-xs font-medium mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 scan-dot" />
                  Powered by yt-dlp · 1800+ sites
                </div>
                <h1 className="font-display text-6xl sm:text-7xl leading-[0.95] mb-4">
                  Paste any link.<br />
                  <span className="italic grad-text">Harvest everything.</span>
                </h1>
                <p className="text-paper-400 text-lg max-w-xl mx-auto">
                  Point MediaHarbor at any webpage. It opens a real browser, scrolls, and grabs every image and video — even the ones hiding behind lazy loading or CDN walls.
                </p>
              </section>
            )}

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
          </main>
        )}

        {screen === "history" && <HistoryList />}
        {screen === "settings" && <SettingsForm />}
      </div>
    </ErrorBoundary>
  );
}
