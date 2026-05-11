const BASE = "http://localhost:8000";

export const getSettings = () => fetch(`${BASE}/settings`).then(r => r.json());

export const saveSettings = (data) =>
  fetch(`${BASE}/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json());

export const getHistory = () => fetch(`${BASE}/history`).then(r => r.json());

export const deleteHistory = (id) =>
  fetch(`${BASE}/history/${id}`, { method: "DELETE" }).then(r => r.json());

export const openFolder = (path) =>
  fetch(`${BASE}/open-folder`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }) }).then(r => r.json());

export function startScan(url, { onStatus, onFound, onDone, onError }) {
  const es = new EventSource(`${BASE}/scan?url=${encodeURIComponent(url)}`);
  es.addEventListener("status", e => onStatus?.(JSON.parse(e.data)));
  es.addEventListener("found",  e => onFound?.(JSON.parse(e.data)));
  es.addEventListener("done",   e => { onDone?.(JSON.parse(e.data)); es.close(); });
  es.onerror = err => { onError?.(err); es.close(); };
  return () => es.close();
}

export async function startDownload(payload, { onProgress, onFileDone, onComplete, onError }) {
  const resp = await fetch(`${BASE}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    let event = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) {
        const data = JSON.parse(line.slice(5).trim());
        if (event === "progress")  onProgress?.(data);
        if (event === "file_done") onFileDone?.(data);
        if (event === "complete")  onComplete?.(data);
        event = "";
      }
    }
  }
}
