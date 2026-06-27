import React, { useEffect, useState } from 'react'
import { sound } from '../sound.js'

export function LaunchOverlay({ countdown, status, onAbort }) {
  return (
    <div className="screen-overlay launch-overlay">
      <div className="countdown-label">T-MINUS</div>
      <div className="countdown-display">{String(countdown).padStart(2, '0')}</div>
      <div className="launch-status">{status || 'LAUNCH SEQUENCE INITIATED'}</div>
      <button
        id="launch-abort-btn"
        className="btn btn-danger"
        onClick={() => { sound.play('error'); onAbort?.() }}
        style={{ marginTop: 20 }}
      >
        🛑 ABORT MISSION
      </button>
    </div>
  )
}

export function ResultOverlay({ result, onReturnToMenu }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { setTimeout(() => setVisible(true), 100) }, [])

  if (!result) return null

  return (
    <div className="screen-overlay launch-overlay" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s' }}>
      <div className="glass-panel result-card">
        <div className="result-icon">{result.success ? '🏆' : '💥'}</div>
        <div className={`result-title ${result.success ? 'success' : 'failure'}`}>
          {result.success ? 'MISSION SUCCESS' : 'MISSION FAILURE'}
        </div>
        <p style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center' }}>{result.message}</p>
        <div className="result-stats">
          <div className="stat">
            <div className="stat-value">{result.altitude}<span style={{ fontSize: 14 }}>m</span></div>
            <div className="stat-label">Max Altitude</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: result.success ? 'var(--c-success)' : 'var(--c-danger)' }}>
              {result.success ? '✓' : '✗'}
            </div>
            <div className="stat-label">Stage 1</div>
          </div>
        </div>
        <button
          id="result-return-btn"
          className="btn btn-primary btn-full"
          onClick={() => { sound.play('click'); onReturnToMenu?.() }}
        >
          Return to Mission Control
        </button>
      </div>
    </div>
  )
}
