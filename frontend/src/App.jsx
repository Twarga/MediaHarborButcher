import { useState, useEffect } from 'react'
import './index.css'

const API_URL = 'http://localhost:8000'

function App() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [screen, setScreen] = useState('home')
  const [history, setHistory] = useState([])
  const [settings, setSettings] = useState({
    outputDir: '/home/twarga/Downloads/MediaHarbor',
    maxPages: 5,
    stealth: true
  })

  useEffect(() => {
    if (screen === 'history') loadHistory()
  }, [screen])

  const loadHistory = async () => {
    try {
      const res = await fetch(API_URL + '/history')
      const data = await res.json()
      setHistory(data.history || [])
    } catch (e) {
      console.error(e)
    }
  }

  const analyzeUrl = async () => {
    if (!url) return
    setLoading(true)
    setStatus('Analyzing...')
    try {
      const res = await fetch(API_URL + '/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, max_scrolls: settings.maxPages })
      })
      const data = await res.json()
      setResults(data)
      setStatus(`Found ${data.image_count} images`)
    } catch (e) {
      setStatus('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const harvestUrl = async () => {
    if (!url) return
    setLoading(true)
    setStatus('Harvesting...')
    try {
      const res = await fetch(API_URL + '/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, output_dir: settings.outputDir, max_scrolls: settings.maxPages })
      })
      const data = await res.json()
      setResults(data)
      setStatus(`Downloaded ${data.new_files} files (${(data.total_size / 1024 / 1024).toFixed(1)} MB)`)
      loadHistory()
    } catch (e) {
      setStatus('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-purple-400">MediaHarbor</h1>
        <div className="flex gap-2">
          {['home', 'history', 'settings'].map(s => (
            <button key={s} onClick={() => setScreen(s)} 
              className={`px-3 py-1 rounded text-sm ${screen === s ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {screen === 'home' && (
        <main className="p-6 max-w-2xl mx-auto">
          <div className="mb-4">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://unsplash.com" className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg"
              onKeyDown={(e) => e.key === 'Enter' && analyzeUrl()} />
          </div>

          <div className="flex gap-3 mb-4">
            <button onClick={analyzeUrl} disabled={loading || !url} 
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-medium">
              Analyze
            </button>
            <button onClick={harvestUrl} disabled={loading || !url} 
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 rounded-lg font-medium">
              Harvest
            </button>
          </div>

          {status && <p className="mb-4 p-3 bg-gray-800 rounded-lg text-center">{status}</p>}

          {results && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-3xl font-bold text-purple-400">{results.image_count}</p>
                <p className="text-gray-500 text-sm">Images</p>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-400">{results.new_files || 0}</p>
                <p className="text-gray-500 text-sm">Downloaded</p>
              </div>
            </div>
          )}
        </main>
      )}

      {screen === 'history' && (
        <main className="p-6 max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Harvest History</h2>
          
          {history.length === 0 ? (
            <p className="text-gray-500">No harvests yet</p>
          ) : (
            <div className="space-y-3">
              {history.map(h => (
                <div key={h.id} className="p-4 bg-gray-800 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="text-white truncate max-w-md">{h.url}</p>
                    <p className="text-gray-500 text-sm">{h.created_at}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400">{h.image_count} images</p>
                    <p className="text-gray-500 text-sm">{h.downloaded_files} downloaded</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {screen === 'settings' && (
        <main className="p-6 max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Output Directory</label>
              <input type="text" value={settings.outputDir} onChange={(e) => setSettings({...settings, outputDir: e.target.value})}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded" />
            </div>
            
            <div>
              <label className="block text-gray-400 text-sm mb-1">Max Pages</label>
              <input type="number" value={settings.maxPages} onChange={(e) => setSettings({...settings, maxPages: parseInt(e.target.value)})}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded" />
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <p className="text-purple-400 font-bold">MediaHarbor v1.0</p>
            <p className="text-gray-500 text-sm">Paste any link. Harvest everything.</p>
          </div>
        </main>
      )}
    </div>
  )
}

export default App