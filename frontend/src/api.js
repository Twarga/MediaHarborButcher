// All endpoints are same-origin in production (FastAPI serves the built
// frontend) and proxied in dev via vite.config.js. Use relative paths.
const BASE = "";

async function jsonFetch(url, options) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

export const getSettings = () => jsonFetch(`${BASE}/settings`);

export const saveSettings = (data) =>
  jsonFetch(`${BASE}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const getHistory = () => jsonFetch(`${BASE}/history`);

export const deleteHistory = (id) =>
  jsonFetch(`${BASE}/history/${id}`, { method: "DELETE" });

export const clearHistory = () =>
  jsonFetch(`${BASE}/history`, { method: "DELETE" });

export const openFolder = (path) =>
  jsonFetch(`${BASE}/open-folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

/**
 * Open an SSE connection to /scan. Returns a cleanup function.
 * onDone is called with the event payload once the scan completes;
 * onError only fires on transport errors before that point.
 */
export function startScan(url, { onStatus, onFound, onDone, onError }) {
  const es = new EventSource(`${BASE}/scan?url=${encodeURIComponent(url)}`);
  let finished = false;

  es.addEventListener("status", (e) => onStatus?.(JSON.parse(e.data)));
  es.addEventListener("found", (e) => onFound?.(JSON.parse(e.data)));
  es.addEventListener("done", (e) => {
    finished = true;
    onDone?.(JSON.parse(e.data));
    es.close();
  });
  es.onerror = (err) => {
    // EventSource always fires 'error' on close, even after 'done' — ignore
    // errors that happen after a successful completion.
    if (finished) return;
    onError?.(err);
    es.close();
  };

  return () => {
    finished = true;
    es.close();
  };
}

/**
 * POST /download then stream SSE events from the response body.
 * Returns a cleanup function that aborts the fetch.
 */
export function startDownload(payload, { onProgress, onFileDone, onComplete, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const resp = await fetch(`${BASE}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Split on any newline; keep trailing partial line in buf.
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, idx).replace(/\r$/, "");
          buf = buf.slice(idx + 1);

          if (!line) {
            // Blank line = end of event; reset current event
            currentEvent = "";
            continue;
          }
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const payloadStr = line.slice(5).trim();
            if (!payloadStr) continue;
            try {
              const data = JSON.parse(payloadStr);
              if (currentEvent === "progress") onProgress?.(data);
              else if (currentEvent === "file_done") onFileDone?.(data);
              else if (currentEvent === "complete") onComplete?.(data);
            } catch {
              // Ignore malformed JSON frames
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err);
    }
  })();

  return () => controller.abort();
}
