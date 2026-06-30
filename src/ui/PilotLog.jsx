import React from 'react'
import { getLog } from '../save.js'
import { sound } from '../sound.js'

export default function PilotLog({ onClose }) {
  const logs = getLog()

  const totalMissions = logs.length
  const successfulMissions = logs.filter(l => l.success).length
  const successRate = totalMissions > 0 ? Math.round((successfulMissions / totalMissions) * 100) : 0
  const maxAltitude = totalMissions > 0 ? Math.max(...logs.map(l => l.altitude || 0)) : 0

  return (
    <div className="screen-overlay" style={{ zIndex: 100, background: 'rgba(2, 12, 27, 0.8)' }}>
      <div className="glass-panel profile-card" style={{ width: 'min(600px, 95vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div className="profile-header" style={{ position: 'relative' }}>
          <span className="badge">OFFICIAL ARCHIVES · PILOT RECORD</span>
          <h2 className="profile-title">Pilot Flight Log</h2>
          <p className="profile-subtitle">Telemetry logs, stage diagnostics, and flight records of all test missions.</p>
          <button
            id="log-close-btn"
            className="btn btn-secondary"
            onClick={() => { sound.play('click'); onClose() }}
            style={{ position: 'absolute', right: 0, top: 0, padding: '6px 12px', fontSize: 10 }}
          >
            ✕ Close
          </button>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(0, 229, 255, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid var(--c-border)' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--c-white)' }}>{totalMissions}</div>
            <div className="label-xs" style={{ marginTop: 2 }}>Missions</div>
          </div>
          <div style={{ width: 1, background: 'rgba(0, 229, 255, 0.15)' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--c-success)' }}>{successRate}%</div>
            <div className="label-xs" style={{ marginTop: 2 }}>Success Rate</div>
          </div>
          <div style={{ width: 1, background: 'rgba(0, 229, 255, 0.15)' }} />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--c-amber)' }}>{maxAltitude}m</div>
            <div className="label-xs" style={{ marginTop: 2 }}>Max Altitude</div>
          </div>
        </div>

        {/* Log Entries List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--c-muted)', fontSize: 13 }}>
              No mission telemetry recorded. Launch a rocket to write your first log entry.
            </div>
          ) : (
            logs.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--c-white)' }}>
                    {entry.rocket}
                  </div>
                  <div style={{ color: 'var(--c-muted)', marginTop: 4, fontSize: 11 }}>
                    {entry.message} · {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--c-cyan)' }}>
                    {entry.altitude}m
                  </div>
                  <div style={{ color: entry.success ? 'var(--c-success)' : 'var(--c-danger)', fontSize: 10, fontWeight: 700, marginTop: 4, letterSpacing: 1 }}>
                    {entry.success ? '✓ SUCCESS' : '✗ FAILED'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
