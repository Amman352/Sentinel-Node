'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'

interface LoginLog {
  id: string
  ip_address: string
  device: string
  login_hour: number
  risk_score: number
  ip_changed: boolean
  new_device: boolean
  location_changed: boolean
  attempts_last_hour: number
  timestamp: string
}

interface Alert {
  id: string
  user_id: string
  risk_score: number
  reason: string
  action_taken: string
  resolved: boolean
  created_at: string
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div style={{ height: 36 }} />
  const max = Math.max(...data, 0.01)
  const w = 140; const h = 36
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 4) - 2
    return `${x},${y}`
  })
  const area = `M${pts[0]} L${pts.join(' L')} L${w},${h} L0,${h} Z`
  const line = `M${pts.join(' L')}`
  const id = `sg${color.replace('#', '')}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle
        cx={parseFloat(pts[pts.length - 1].split(',')[0])}
        cy={parseFloat(pts[pts.length - 1].split(',')[1])}
        r={3} fill={color}
      />
    </svg>
  )
}

function RiskBarChart({ logs }: { logs: LoginLog[] }) {
  const recent = [...logs].slice(0, 24).reverse()
  const barW = 18; const gap = 4; const h = 110; const total = recent.length || 1
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(total * (barW + gap) + 24, 300)} height={h + 28} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line x1={0} y1={h - v * h} x2={total * (barW + gap) + 20} y2={h - v * h} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
            <text x={-4} y={h - v * h + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{v.toFixed(1)}</text>
          </g>
        ))}
        <line x1={0} y1={h - 0.5 * h} x2={total * (barW + gap) + 20} y2={h - 0.5 * h} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" />
        <text x={2} y={h - 0.5 * h - 4} fontSize={9} fill="#f59e0b">alert 0.5</text>
        <line x1={0} y1={h - 0.9 * h} x2={total * (barW + gap) + 20} y2={h - 0.9 * h} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" />
        <text x={2} y={h - 0.9 * h - 4} fontSize={9} fill="#ef4444">block 0.9</text>
        {recent.map((log, i) => {
          const score = log.risk_score ?? 0
          const barH = Math.max(score * h, 3)
          const color = score >= 0.9 ? '#ef4444' : score >= 0.5 ? '#f59e0b' : '#10b981'
          const x = i * (barW + gap) + 20
          return (
            <g key={log.id}>
              <rect x={x} y={h - barH} width={barW} height={barH} fill={color} opacity={0.8} rx={2} />
              <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize={8} fill="#94a3b8">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ScoreDonut({ value, label }: { value: number; label: string }) {
  const r = 28; const circ = 2 * Math.PI * r; const filled = value * circ
  const color = value >= 0.9 ? '#ef4444' : value >= 0.5 ? '#f59e0b' : '#10b981'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={72} height={72} viewBox="0 0 72 72">
        <circle cx={36} cy={36} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
        <text x={36} y={40} textAnchor="middle" fontSize={13} fontWeight={600} fill={color}>
          {(value * 100).toFixed(0)}
        </text>
      </svg>
      <span style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

function VerdictBadge({ score }: { score: number }) {
  const cfg = score >= 0.9
    ? { label: 'BLOCKED', bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' }
    : score >= 0.5
    ? { label: 'ALERT', bg: '#fffbeb', color: '#d97706', border: '#fcd34d' }
    : { label: 'NORMAL', bg: '#f0fdf4', color: '#16a34a', border: '#86efac' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap'
    }}>
      {cfg.label}
    </span>
  )
}

function ActivityDashboard({ logs, alerts, loading, avgScore, highRisk, alertCount,
  thresholdHour, setThresholdHour, thresholdIp, setThresholdIp, thresholdAttempts, setThresholdAttempts,
  testScore, testVerdict, scoreChartData, testThreshold, simulating, simulate, fetchData
}: any) {
  const scoreColor = (s: number) => s >= 0.9 ? '#ef4444' : s >= 0.5 ? '#f59e0b' : '#10b981'
  const totalLogins = logs.length
  const activeAlerts = alerts.filter((a: any) => !a.resolved).length
  const blocked = alerts.filter((a: any) => a.action_taken?.includes('disabled') || a.action_taken?.includes('block')).length

  return (
    <div style={{ padding: 24 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Current SentinelScore', sub: 'Today', value: `${Math.round(avgScore * 100)} / 100`, sparkData: logs.slice(0, 20).map((l: LoginLog) => l.risk_score || 0).reverse(), color: scoreColor(avgScore) },
          { label: 'New detections', sub: 'Total logins', value: totalLogins, sparkData: Array.from({ length: 10 }, (_: any, i: number) => logs[i]?.risk_score || 0).reverse(), color: '#3b82f6' },
          { label: 'Active alerts', sub: 'Unresolved', value: activeAlerts, sparkData: [], color: activeAlerts > 0 ? '#f59e0b' : '#10b981' },
          { label: 'Blocked accounts', sub: 'Auto-blocked', value: blocked, sparkData: [], color: blocked > 0 ? '#ef4444' : '#10b981' },
        ].map(card => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 16px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{card.label}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>{card.sub}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.color, lineHeight: 1, marginBottom: 8 }}>{loading ? '—' : card.value}</div>
            {card.sparkData.length > 1 && <Sparkline data={card.sparkData} color={card.color} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ gridColumn: '1/3', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Risk score over time</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Last {Math.min(logs.length, 24)} login events · — alert 0.5 · — block 0.9</div>
          {loading ? (
            <div style={{ height: 138, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12 }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={{ height: 138, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 12 }}>No data yet · simulate a login below</div>
          ) : (
            <RiskBarChart logs={logs} />
          )}
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Score distribution</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Avg / blocked / alerts</div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <ScoreDonut value={avgScore} label="avg score" />
            <ScoreDonut value={logs.length ? highRisk / logs.length : 0} label="blocked %" />
            <ScoreDonut value={logs.length ? alertCount / logs.length : 0} label="alert %" />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>ML threshold tester</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Adjust inputs · see if score crosses 0.5 (alert) or 0.9 (block)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>
                Login hour: <strong style={{ color: '#0f172a' }}>{thresholdHour}:00</strong>
              </label>
              <input type="range" min={0} max={23} value={thresholdHour} onChange={(e) => setThresholdHour(Number(e.target.value))} style={{ width: '100%', accentColor: '#e63946' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                <span>0h</span><span style={{ color: '#10b981' }}>8–20 normal</span><span>23h</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>
                Attempts: <strong style={{ color: '#0f172a' }}>{thresholdAttempts}</strong>
              </label>
              <input type="range" min={1} max={20} value={thresholdAttempts} onChange={(e) => setThresholdAttempts(Number(e.target.value))} style={{ width: '100%', accentColor: '#e63946' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                <span>1</span><span style={{ color: '#10b981' }}>1–2 normal</span><span>20</span>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 6 }}>
              IP changed: <strong style={{ color: thresholdIp ? '#d97706' : '#16a34a' }}>{thresholdIp ? 'YES — suspicious' : 'NO — same IP'}</strong>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { val: 0, label: 'Same IP', active: '#f0fdf4', activeBorder: '#86efac', activeText: '#16a34a' },
                { val: 1, label: 'New IP', active: '#fffbeb', activeBorder: '#fcd34d', activeText: '#d97706' }
              ].map(btn => (
                <button key={btn.val} onClick={() => setThresholdIp(btn.val)} style={{
                  flex: 1, padding: '7px 0',
                  background: thresholdIp === btn.val ? btn.active : '#f8fafc',
                  border: `1px solid ${thresholdIp === btn.val ? btn.activeBorder : '#e2e8f0'}`,
                  borderRadius: 6, color: thresholdIp === btn.val ? btn.activeText : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: thresholdIp === btn.val ? 600 : 400
                }}>{btn.label}</button>
              ))}
            </div>
          </div>
          <button onClick={testThreshold} style={{ width: '100%', padding: '10px 0', background: '#0f172a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600, marginBottom: 12 }}>
            ▶ Run ML prediction
          </button>
          {testScore !== null && (
            <div style={{ background: testScore >= 0.9 ? '#fef2f2' : testScore >= 0.5 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${testScore >= 0.9 ? '#fca5a5' : testScore >= 0.5 ? '#fcd34d' : '#86efac'}`, borderRadius: 7, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Risk score</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor(testScore), lineHeight: 1 }}>{testScore.toFixed(3)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <VerdictBadge score={testScore} />
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                  {testScore >= 0.9 ? '→ user would be blocked' : testScore >= 0.5 ? '→ alert would be created' : '→ log only, no action'}
                </div>
              </div>
            </div>
          )}
          {scoreChartData.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Score history ({scoreChartData.length} tests)</div>
              <Sparkline data={scoreChartData} color={testScore !== null ? scoreColor(testScore) : '#3b82f6'} />
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflowY: 'auto', maxHeight: 420 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Active alerts</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Unresolved · {activeAlerts} item{activeAlerts !== 1 ? 's' : ''}</div>
          {loading ? (
            <div style={{ color: '#cbd5e1', fontSize: 12 }}>Loading…</div>
          ) : alerts.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, paddingTop: 20, textAlign: 'center' }}>✓ No active alerts — system clean</div>
          ) : (
            alerts.map((alert: Alert) => (
              <div key={alert.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <VerdictBadge score={alert.risk_score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#334155', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.reason}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{alert.action_taken} · {new Date(alert.created_at).toLocaleTimeString()}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: alert.risk_score >= 0.9 ? '#dc2626' : alert.risk_score >= 0.5 ? '#d97706' : '#16a34a', flexShrink: 0 }}>
                  {alert.risk_score?.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>Simulate detections</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Send a real event through Clerk → Backend → ML → SOAR pipeline</div>
        </div>
        {[
          { type: 'normal' as const, label: '+ Normal login', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', desc: 'score ~0.1' },
          { type: 'suspicious' as const, label: '+ Suspicious', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', desc: 'score ~0.5' },
          { type: 'brute' as const, label: '+ Brute force', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', desc: 'score ~0.95' },
        ].map(btn => (
          <button key={btn.type} onClick={() => simulate(btn.type)} disabled={simulating !== null} style={{
            padding: '8px 18px',
            background: simulating === btn.type ? btn.bg : '#f8fafc',
            border: `1px solid ${simulating === btn.type ? btn.border : '#e2e8f0'}`,
            borderRadius: 7, color: simulating === btn.type ? btn.color : '#475569',
            fontSize: 11, cursor: simulating ? 'not-allowed' : 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            opacity: simulating && simulating !== btn.type ? 0.4 : 1, transition: 'all 0.15s', fontWeight: 600
          }}>
            <span>{simulating === btn.type ? '…' : btn.label}</span>
            <span style={{ fontSize: 9, opacity: 0.6, fontWeight: 400 }}>{btn.desc}</span>
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Most recent detections</span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 10 }}>{totalLogins} total</span>
          </div>
          <button onClick={fetchData} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 12px', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>↻ Refresh</button>
        </div>
        {loading ? (
          <div style={{ padding: 24, color: '#cbd5e1', fontSize: 12, textAlign: 'center' }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 32, color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>No detections yet · use simulate buttons above</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Severity', 'Tactic & technique', 'Time', 'IP address', 'Device', 'Risk score', 'Verdict'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: LoginLog) => {
                  const score = log.risk_score ?? 0
                  const dotColor = score >= 0.9 ? '#ef4444' : score >= 0.5 ? '#f59e0b' : '#10b981'
                  const sevLabel = score >= 0.9 ? 'High' : score >= 0.5 ? 'Medium' : 'Info'
                  const technique = score >= 0.9 ? 'Brute force / credential stuffing' : score >= 0.5 ? 'Suspicious login pattern' : 'Normal authentication'
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: dotColor, fontWeight: 500 }}>{sevLabel}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>{technique}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap' }}>{log.ip_address}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.device}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: dotColor }}>{score.toFixed(3)}</td>
                      <td style={{ padding: '10px 14px' }}><VerdictBadge score={score} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function DetectionsPage({ logs, alerts, loading }: { logs: LoginLog[]; alerts: Alert[]; loading: boolean }) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'normal'>('all')
  const filtered = logs.filter(l => {
    const s = l.risk_score ?? 0
    if (filter === 'high') return s >= 0.9
    if (filter === 'medium') return s >= 0.5 && s < 0.9
    if (filter === 'normal') return s < 0.5
    return true
  })

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Endpoint detections</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>All login events scored by the Isolation Forest ML model</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total events', value: logs.length, color: '#3b82f6', sub: 'All time' },
          { label: 'High severity', value: logs.filter(l => (l.risk_score ?? 0) >= 0.9).length, color: '#ef4444', sub: 'Score ≥ 0.9 → auto blocked' },
          { label: 'Medium severity', value: logs.filter(l => { const s = l.risk_score ?? 0; return s >= 0.5 && s < 0.9 }).length, color: '#f59e0b', sub: 'Score 0.5–0.89 → alert raised' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color, marginBottom: 2 }}>{loading ? '—' : c.value}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'high', 'medium', 'normal'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 6,
            background: filter === f ? '#0f172a' : '#f8fafc',
            border: `1px solid ${filter === f ? '#0f172a' : '#e2e8f0'}`,
            color: filter === f ? '#fff' : '#64748b',
            fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 600 : 400, textTransform: 'capitalize'
          }}>
            {f === 'all' ? `All (${logs.length})` :
              f === 'high' ? `High (${logs.filter(l => (l.risk_score ?? 0) >= 0.9).length})` :
              f === 'medium' ? `Medium (${logs.filter(l => { const s = l.risk_score ?? 0; return s >= 0.5 && s < 0.9 }).length})` :
              `Normal (${logs.filter(l => (l.risk_score ?? 0) < 0.5).length})`}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No detections for this filter</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Severity', 'IP address', 'Device', 'Hour', 'Attempts', 'IP changed', 'New device', 'Score', 'Verdict', 'Time'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log: LoginLog) => {
                  const score = log.risk_score ?? 0
                  const dotColor = score >= 0.9 ? '#ef4444' : score >= 0.5 ? '#f59e0b' : '#10b981'
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
                          <span style={{ fontSize: 11, color: dotColor, fontWeight: 500 }}>{score >= 0.9 ? 'High' : score >= 0.5 ? 'Medium' : 'Info'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap' }}>{log.ip_address}</td>
                      <td style={{ padding: '9px 14px', color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.device}</td>
                      <td style={{ padding: '9px 14px', color: '#475569' }}>{log.login_hour}:00</td>
                      <td style={{ padding: '9px 14px', color: '#475569' }}>{log.attempts_last_hour}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: log.ip_changed ? '#fef2f2' : '#f0fdf4', color: log.ip_changed ? '#dc2626' : '#16a34a', border: `1px solid ${log.ip_changed ? '#fca5a5' : '#86efac'}`, fontWeight: 600 }}>
                          {log.ip_changed ? 'YES' : 'NO'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: log.new_device ? '#fef2f2' : '#f0fdf4', color: log.new_device ? '#dc2626' : '#16a34a', border: `1px solid ${log.new_device ? '#fca5a5' : '#86efac'}`, fontWeight: 600 }}>
                          {log.new_device ? 'YES' : 'NO'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', fontWeight: 700, color: dotColor }}>{score.toFixed(3)}</td>
                      <td style={{ padding: '9px 14px' }}><VerdictBadge score={score} /></td>
                      <td style={{ padding: '9px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SOARPage({ alerts, loading }: { alerts: Alert[]; loading: boolean }) {
  const total = alerts.length
  const autoBlocked = alerts.filter(a => a.action_taken?.includes('disabled') || a.action_taken?.includes('block')).length
  const alertOnly = alerts.filter(a => a.action_taken === 'alert_only').length
  const resolved = alerts.filter(a => a.resolved).length

  const workflowRules = [
    { name: 'Auto-block on score ≥ 0.9', trigger: 'Risk score threshold', action: 'Disable Clerk user + create alert', status: 'Active', color: '#16a34a' },
    { name: 'Alert on score ≥ 0.5', trigger: 'Risk score threshold', action: 'Create alert record in Supabase', status: 'Active', color: '#16a34a' },
    { name: 'Log only on score < 0.5', trigger: 'Risk score threshold', action: 'Store log, no action', status: 'Active', color: '#16a34a' },
    { name: 'Cloudflare IP block', trigger: 'score ≥ 0.9', action: 'Block IP via Cloudflare API', status: 'Pending setup', color: '#d97706' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>SOAR engine</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Security Orchestration, Automation and Response — automated threat workflows</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total executions', value: total, color: '#3b82f6', icon: '⚡' },
          { label: 'Auto blocked', value: autoBlocked, color: '#ef4444', icon: '🔒' },
          { label: 'Alerts raised', value: alertOnly, color: '#f59e0b', icon: '⚠' },
          { label: 'Resolved', value: resolved, color: '#10b981', icon: '✓' },
        ].map(c => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{loading ? '—' : c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>All workflows</span>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 10 }}>{workflowRules.length} total</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Workflow name', 'Trigger', 'Actions', 'Status'].map(h => (
                <th key={h} style={{ padding: '9px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workflowRules.map((w, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '12px 18px', color: '#0f172a', fontWeight: 500 }}>{w.name}</td>
                <td style={{ padding: '12px 18px', color: '#475569' }}>{w.trigger}</td>
                <td style={{ padding: '12px 18px', color: '#475569' }}>{w.action}</td>
                <td style={{ padding: '12px 18px' }}>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 4, fontWeight: 600, background: w.color === '#16a34a' ? '#f0fdf4' : '#fffbeb', color: w.color, border: `1px solid ${w.color === '#16a34a' ? '#86efac' : '#fcd34d'}` }}>
                    {w.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Recent executions</span>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 10 }}>{total} items</span>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading…</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No SOAR executions yet · simulate a brute force attack to trigger one</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Execution date', 'Trigger score', 'Action taken', 'Resolved', 'Reason'].map(h => (
                  <th key={h} style={{ padding: '9px 18px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert: Alert) => (
                <tr key={alert.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 18px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(alert.created_at).toLocaleString()}</td>
                  <td style={{ padding: '10px 18px' }}><VerdictBadge score={alert.risk_score} /></td>
                  <td style={{ padding: '10px 18px', color: '#475569' }}>{alert.action_taken}</td>
                  <td style={{ padding: '10px 18px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: alert.resolved ? '#f0fdf4' : '#fef2f2', color: alert.resolved ? '#16a34a' : '#dc2626', border: `1px solid ${alert.resolved ? '#86efac' : '#fca5a5'}` }}>
                      {alert.resolved ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 18px', color: '#64748b', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function MLInsightsPage({ logs, loading }: { logs: LoginLog[]; loading: boolean }) {
  const avgScore = logs.length ? logs.reduce((s, l) => s + (l.risk_score || 0), 0) / logs.length : 0
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const hl = logs.filter(l => l.login_hour === h)
    return { hour: h, count: hl.length, avg: hl.length ? hl.reduce((s, l) => s + (l.risk_score || 0), 0) / hl.length : 0 }
  })
  const topHours = [...byHour].filter(h => h.count > 0).sort((a, b) => b.avg - a.avg).slice(0, 5)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>ML insights</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Isolation Forest model analysis and feature importance</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Model configuration</div>
          {[
            { label: 'Algorithm', value: 'Isolation Forest' },
            { label: 'Training data', value: '600 synthetic + real logins' },
            { label: 'Contamination', value: '5% (aggressive)' },
            { label: 'Features', value: '5 (hour, ip, attempts, location, device)' },
            { label: 'Alert threshold', value: 'score ≥ 0.50' },
            { label: 'Block threshold', value: 'score ≥ 0.90' },
            { label: 'Model file', value: 'ml-service/model.pkl' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <span style={{ color: '#64748b' }}>{row.label}</span>
              <span style={{ color: '#0f172a', fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 14 }}>Feature risk contribution</div>
          {[
            { feature: 'login_hour (off-hours)', weight: 0.35, desc: 'Login at 0–7h or 22–23h' },
            { feature: 'attempts_last_hour (high)', weight: 0.30, desc: 'More than 2 attempts/hour' },
            { feature: 'ip_changed', weight: 0.20, desc: 'Different IP from history' },
            { feature: 'new_device', weight: 0.10, desc: 'New browser/OS combo' },
            { feature: 'location_changed', weight: 0.05, desc: 'Different city/country' },
          ].map(f => (
            <div key={f.feature} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>{f.feature}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{(f.weight * 100).toFixed(0)}%</span>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ width: `${f.weight * 100}%`, height: '100%', background: f.weight > 0.25 ? '#ef4444' : f.weight > 0.15 ? '#f59e0b' : '#10b981', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Riskiest login hours (from your data)</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Average risk score per login hour · based on {logs.length} recorded events</div>
        {loading ? (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading…</div>
        ) : topHours.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 12 }}>No data yet · simulate logins to populate this</div>
        ) : (
          topHours.map(h => (
            <div key={h.hour} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 40, fontSize: 12, color: '#475569', textAlign: 'right' }}>{h.hour}:00</div>
              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${h.avg * 100}%`, height: '100%', background: h.avg >= 0.9 ? '#ef4444' : h.avg >= 0.5 ? '#f59e0b' : '#10b981', borderRadius: 4 }} />
              </div>
              <div style={{ width: 40, fontSize: 12, fontWeight: 600, color: h.avg >= 0.9 ? '#ef4444' : h.avg >= 0.5 ? '#d97706' : '#16a34a' }}>{h.avg.toFixed(2)}</div>
              <div style={{ width: 60, fontSize: 10, color: '#94a3b8' }}>{h.count} login{h.count !== 1 ? 's' : ''}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SettingsPage() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Settings</h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Service endpoints and configuration</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          { title: 'ML Service', url: 'http://localhost:8000', desc: 'FastAPI Isolation Forest · POST /predict · GET /health', color: '#10b981' },
          { title: 'Backend API', url: 'http://localhost:8001', desc: 'FastAPI SOAR engine · POST /api/ingest-log · GET /api/logs', color: '#3b82f6' },
          { title: 'Clerk Auth', url: 'https://clerk.com', desc: 'Authentication webhooks · session.created → ingest-log', color: '#7c3aed' },
          { title: 'Supabase DB', url: 'https://supabase.com', desc: 'PostgreSQL · users · login_logs · alerts tables', color: '#0891b2' },
        ].map(s => (
          <div key={s.title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{s.title}</span>
            </div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#475569', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>{s.url}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{s.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>Startup commands</div>
        {[
          { label: 'ML service (port 8000)', cmd: 'cd ml-service && source venv/bin/activate && uvicorn main:app --reload --port 8000' },
          { label: 'Backend (port 8001)', cmd: 'cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8001' },
          { label: 'Frontend (port 3000)', cmd: 'cd frontend && npm run dev' },
          { label: 'ngrok tunnel', cmd: 'ngrok http 8001 --region=in' },
        ].map(r => (
          <div key={r.label} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{r.label}</div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#0f172a', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: 6 }}>{r.cmd}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [backendOnline, setBackendOnline] = useState(false)
  const [activeNav, setActiveNav] = useState('Activity dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [lastRefresh, setLastRefresh] = useState('')
  const [simulating, setSimulating] = useState<string | null>(null)
  const [testScore, setTestScore] = useState<number | null>(null)
  const [testVerdict, setTestVerdict] = useState<string | null>(null)
  const [thresholdHour, setThresholdHour] = useState(3)
  const [thresholdIp, setThresholdIp] = useState(1)
  const [thresholdAttempts, setThresholdAttempts] = useState(5)
  const scoreHistory = useRef<number[]>([])
  const [scoreChartData, setScoreChartData] = useState<number[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [l, a] = await Promise.all([
        fetch(`${BACKEND}/api/logs`).then(r => r.json()),
        fetch(`${BACKEND}/api/alerts`).then(r => r.json()),
      ])
      setLogs(l.logs || [])
      setAlerts(a.alerts || [])
      setLastRefresh(new Date().toLocaleTimeString())
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 10000)
    return () => clearInterval(t)
  }, [fetchData])

  const testThreshold = async () => {
    try {
      const res = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_hour: thresholdHour, ip_changed: thresholdIp,
          attempts_last_hour: thresholdAttempts, location_changed: 0, new_device: thresholdIp,
        }),
      })
      const data = await res.json()
      setTestScore(data.risk_score)
      setTestVerdict(data.verdict)
      scoreHistory.current = [...scoreHistory.current.slice(-19), data.risk_score]
      setScoreChartData([...scoreHistory.current])
    } catch {
      setTestScore(null)
      setTestVerdict('ml-service offline — start it first')
    }
  }

  const simulate = async (type: 'normal' | 'suspicious' | 'brute') => {
    setSimulating(type)
    try {
      await fetch(`${BACKEND}/api/ingest-log`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'session.created', data: { user_id: `user_sim_${type}_${Date.now()}` } }),
      })
    } catch {}
    setTimeout(() => { fetchData(); setSimulating(null) }, 800)
  }

  const avgScore = logs.length ? logs.reduce((s, l) => s + (l.risk_score || 0), 0) / logs.length : 0
  const highRisk = logs.filter(l => (l.risk_score || 0) >= 0.9).length
  const alertCount = logs.filter(l => { const s = l.risk_score || 0; return s >= 0.5 && s < 0.9 }).length
  const activeAlerts = alerts.filter(a => !a.resolved).length

  const navSections = [
    {
      title: 'MONITOR', items: [
        { icon: '⊞', label: 'Activity dashboard' },
        { icon: '◎', label: 'Detections' },
        { icon: '⚡', label: 'SOAR engine' },
      ]
    },
    {
      title: 'ANALYZE', items: [
        { icon: '◈', label: 'ML insights' },
        { icon: '⚙', label: 'Settings' },
      ]
    },
  ]

  const sharedProps = { logs, alerts, loading, fetchData }
  const activityProps = {
    ...sharedProps, avgScore, highRisk, alertCount,
    thresholdHour, setThresholdHour, thresholdIp, setThresholdIp,
    thresholdAttempts, setThresholdAttempts,
    testScore, testVerdict, scoreChartData, testThreshold,
    simulating, simulate,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif', display: 'flex' }}>

      <aside style={{ width: sidebarOpen ? 216 : 48, minHeight: '100vh', background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '14px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setSidebarOpen(!sidebarOpen)}>
          <div style={{ width: 26, height: 26, background: '#e63946', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>S</div>
          {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>SentinelNode</span>}
        </div>

        {navSections.map(section => (
          <div key={section.title}>
            {sidebarOpen && (
              <div style={{ padding: '12px 12px 4px', fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 600 }}>{section.title}</div>
            )}
            {section.items.map(item => (
              <button key={item.label} onClick={() => setActiveNav(item.label)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: activeNav === item.label ? '#fef2f2' : 'transparent',
                border: 'none', borderLeft: `2px solid ${activeNav === item.label ? '#e63946' : 'transparent'}`,
                color: activeNav === item.label ? '#e63946' : '#64748b',
                cursor: 'pointer', fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap', width: '100%',
                fontWeight: activeNav === item.label ? 600 : 400,
              }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && item.label}
              </button>
            ))}
          </div>
        ))}

        <div style={{ flex: 1 }} />
        {sidebarOpen && (
          <div style={{ padding: '12px', borderTop: '1px solid #f1f5f9', fontSize: 10, color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: backendOnline ? '#10b981' : '#ef4444', display: 'inline-block' }} />
              <span>Backend {backendOnline ? 'online' : 'offline'}</span>
            </div>
            {lastRefresh && <div>Refreshed {lastRefresh}</div>}
          </div>
        )}
      </aside>

      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <div style={{ height: 48, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Endpoint security</span>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>{activeNav}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!backendOnline && (
              <div style={{ fontSize: 11, color: '#d97706', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '3px 10px' }}>
                ⚠ Backend offline — start it on port 8001
              </div>
            )}
            {activeAlerts > 0 && (
              <div style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 10px' }}>
                ⚠ {activeAlerts} active alert{activeAlerts !== 1 ? 's' : ''}
              </div>
            )}
            <button onClick={fetchData} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 12px', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>↻ Refresh</button>
          </div>
        </div>

        {activeNav === 'Activity dashboard' && <ActivityDashboard {...activityProps} />}
        {activeNav === 'Detections' && <DetectionsPage logs={logs} alerts={alerts} loading={loading} />}
        {activeNav === 'SOAR engine' && <SOARPage alerts={alerts} loading={loading} />}
        {activeNav === 'ML insights' && <MLInsightsPage logs={logs} loading={loading} />}
        {activeNav === 'Settings' && <SettingsPage />}
      </main>
    </div>
  )
}