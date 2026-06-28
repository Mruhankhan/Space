import React, { useEffect, useState, useCallback, useRef } from 'react'
import { sound } from '../sound.js'
import { renderer } from '../renderer.js'

const TIER_INFO = {
  gold:   { label: 'GOLD',   color: '#ffd700' },
  silver: { label: 'SILVER', color: '#c0c0c0' },
  bronze: { label: 'BRONZE', color: '#cd7f32' },
  fail:   { label: 'NO TIER', color: '#888' },
}

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
  const [copied, setCopied] = useState(false)
  const [dataUrl, setDataUrl] = useState(null)
  useEffect(() => { setTimeout(() => setVisible(true), 100) }, [])

  useEffect(() => {
    if (!result) return
    // Grab a fresh frame once the result is visible.
    setTimeout(() => {
      try {
        const url = renderer.getCanvasDataURL?.('image/png')
        if (url) setDataUrl(url)
      } catch (e) { /* ignore */ }
    }, 200)
  }, [result])

  const handleCopy = useCallback(() => {
    if (!result) return
    const tier = TIER_INFO[result.tier] || TIER_INFO.fail
    const lines = [
      `🚀 Space Rocket Builder — Mission Result`,
      ``,
      `Outcome: ${result.success ? '✅ SUCCESS' : '❌ FAILURE'}`,
      `Tier:    ${tier.label}`,
      `Score:   ${result.score || 0}`,
      `Altitude: ${result.altitude || 0} m`,
      `Mission: ${result.mission?.label || '—'}`,
      result.message ? `Note:    ${result.message}` : '',
      ``,
      `Play at ${typeof window !== 'undefined' ? window.location.origin : ''}`,
    ].filter(Boolean)
    const text = lines.join('\n')
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
        .catch(() => { fallbackCopy(text) })
    } else {
      fallbackCopy(text)
    }
    function fallbackCopy(t) {
      try {
        const ta = document.createElement('textarea')
        ta.value = t
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(true); setTimeout(() => setCopied(false), 1800)
      } catch {}
    }
  }, [result])

  const handleDownload = useCallback(() => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `mission-${Date.now()}.png`
    a.click()
  }, [dataUrl])

  if (!result) return null

  const tier = TIER_INFO[result.tier] || TIER_INFO.fail

  return (
    <div className="screen-overlay launch-overlay" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s' }}>
      <div className="glass-panel result-card">
        <div className="result-icon">{result.success ? '🏆' : '💥'}</div>
        <div className={`result-title ${result.success ? 'success' : 'failure'}`}>
          {result.success ? 'MISSION SUCCESS' : 'MISSION FAILURE'}
        </div>
        <p style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center' }}>{result.message}</p>

        {result.mission && (
          <div style={{ fontSize: 11, color: 'var(--c-muted)', textAlign: 'center', marginTop: -6, marginBottom: 8 }}>
            Mission: <span style={{ color: 'var(--c-cyan)' }}>{result.mission.label}</span>
          </div>
        )}

        <div className="result-stats">
          <div className="stat">
            <div className="stat-value">{result.altitude}<span style={{ fontSize: 14 }}>m</span></div>
            <div className="stat-label">Max Altitude</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: tier.color }}>{tier.label}</div>
            <div className="stat-label">Tier</div>
          </div>
          <div className="stat">
            <div className="stat-value">{result.score || 0}</div>
            <div className="stat-label">Score</div>
          </div>
        </div>

        <div className="result-share">
          <button
            id="result-copy-btn"
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
          >
            {copied ? '✓ Copied!' : '📋 Copy Result'}
          </button>
          <button
            id="result-download-btn"
            type="button"
            className="btn btn-secondary"
            onClick={handleDownload}
            disabled={!dataUrl}
          >
            ⬇ Screenshot
          </button>
        </div>

        <button
          id="result-return-btn"
          className="btn btn-primary btn-full"
          onClick={() => { sound.play('click'); onReturnToMenu?.() }}
          style={{ marginTop: 12 }}
        >
          Return to Mission Control
        </button>
      </div>
    </div>
  )
}