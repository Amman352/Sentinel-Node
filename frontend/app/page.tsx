'use client'
import { useEffect, useState } from 'react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

interface LoginLog {
  id: string
  ip_address: string
  device: string
  login_hour: number
  risk_score: number
  attempts_last_hour: number
  timestamp: string
}

interface Alert {
  id: string
  risk_score: number
  reason: string
  action_taken: string
  created_at: string
}

export default function Dashboard() {
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [l, a] = await Promise.all([
        fetch(`${BACKEND}/api/logs`).then(r => r.json()),
        fetch(`${BACKEND}/api/alerts`).then(r => r.json()),
      ])
      setLogs(l.logs || [])
      setAlerts(a.alerts || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 10000)
    return () => clearInterval(t)
  }, [])

  const scoreColor = (s: number) =>
    s >= 0.9 ? 'text-red-400' : s >= 0.5 ? 'text-yellow-400' : 'text-green-400'

  const scoreBadge = (s: number) =>
    s >= 0.9 ? 'bg-red-900 text-red-300' : s >= 0.5 ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'

  const verdict = (s: number) =>
    s >= 0.9 ? 'BLOCK' : s >= 0.5 ? 'ALERT' : 'NORMAL'

  const avg = logs.length
    ? (logs.reduce((s, l) => s + (l.risk_score || 0), 0) / logs.length).toFixed(2)
    : '0.00'

  const simulate = async () => {
    await fetch(`${BACKEND}/api/ingest-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'session.created', data: { user_id: 'user_dashboard_test' } }),
    })
    setTimeout(fetchData, 600)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">S</div>
          <h1 className="text-xl font-semibold">SentinelNode</h1>
          <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Live</span>
        </div>
        <span className="text-xs text-gray-500">Refreshes every 10s</span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Logins recorded', value: logs.length, color: 'text-white' },
          { label: 'Active alerts', value: alerts.length, color: alerts.length > 0 ? 'text-red-400' : 'text-white' },
          { label: 'Accounts blocked', value: alerts.filter(a => a.action_taken?.includes('disabled')).length, color: 'text-yellow-400' },
          { label: 'Avg risk score', value: avg, color: parseFloat(avg) > 0.5 ? 'text-yellow-400' : 'text-green-400' },
        ].map(c => (
          <div key={c.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-semibold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Active Alerts</h2>
          {loading ? <p className="text-gray-500 text-sm">Loading...</p>
            : alerts.length === 0 ? <p className="text-gray-500 text-sm">No active alerts — system clean ✓</p>
            : alerts.map(a => (
              <div key={a.id} className="flex items-start gap-3 border-b border-gray-800 pb-3 mb-3 last:border-0 last:mb-0">
                <span className={`text-xs font-bold px-2 py-1 rounded ${scoreBadge(a.risk_score)}`}>
                  {a.risk_score?.toFixed(2)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate">{a.reason}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.action_taken}</p>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          }
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-3">Simulate Login Event</h2>
          <p className="text-xs text-gray-500 mb-4">Test the ML pipeline directly from the dashboard.</p>
          <div className="space-y-2">
            <button onClick={simulate} className="w-full text-xs px-3 py-2 rounded-lg bg-green-900 hover:bg-green-800 text-green-300 transition-colors">
              Normal login (9am, same IP)
            </button>
            <button onClick={simulate} className="w-full text-xs px-3 py-2 rounded-lg bg-yellow-900 hover:bg-yellow-800 text-yellow-300 transition-colors">
              Suspicious (3am, new country)
            </button>
            <button onClick={simulate} className="w-full text-xs px-3 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-red-300 transition-colors">
              Brute force (15 attempts)
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Login Activity Log</h2>
        {loading ? <p className="text-gray-500 text-sm">Loading...</p>
          : logs.length === 0 ? <p className="text-gray-500 text-sm">No logins yet. Click a simulate button above.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    {['Time', 'IP', 'Device', 'Hour', 'Attempts', 'Risk Score', 'Verdict'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2 pr-4 font-mono text-gray-300">{log.ip_address}</td>
                      <td className="py-2 pr-4 text-gray-400 max-w-xs truncate">{log.device}</td>
                      <td className="py-2 pr-4 text-gray-400">{log.login_hour}:00</td>
                      <td className="py-2 pr-4 text-gray-400">{log.attempts_last_hour}</td>
                      <td className={`py-2 pr-4 font-semibold ${scoreColor(log.risk_score)}`}>
                        {log.risk_score?.toFixed(2) ?? '—'}
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${scoreBadge(log.risk_score)}`}>
                          {verdict(log.risk_score)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </main>
  )
}