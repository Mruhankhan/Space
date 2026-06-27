import React from 'react'
import { sound } from '../sound.js'

export default function HUD({ deck, position, onExitToMenu, onLaunch, insideRocket }) {
  const pos = position || { x: 0, y: 0, z: 0 }
  return (
    <div className="hud">
      {/* Top-left status */}
      <div className="hud-top">
        <div className="hud-panel">
          {insideRocket ? (
            <div className="deck-indicator">
              <div className="deck-dot" />
              <div>
                <div className="label-sm">Current Deck</div>
                <div style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--c-white)', marginTop: 2 }}>
                  {deck || 'BOARDING...'}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="label-xs">Launch Complex · Bay Alpha</div>
              <div className="label-sm" style={{ marginTop: 4 }}>Test Facility — Free Roam</div>
            </div>
          )}
          <div className="coords">
            X {pos.x.toFixed(1)} &nbsp; Y {pos.y.toFixed(1)} &nbsp; Z {pos.z.toFixed(1)}
          </div>
        </div>

        {/* Top-right — suit status */}
        <div className="hud-panel" style={{ alignItems: 'flex-end' }}>
          <div className="label-xs">Suit Systems</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {[['O₂', 98, 'var(--c-cyan)'], ['Power', 100, 'var(--c-success)'], ['Pressure', 100, 'var(--c-amber)']].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                <span style={{ color: 'var(--c-muted)', width: 48 }}>{label}</span>
                <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
                <span style={{ color, fontFamily: 'var(--font-display)', fontSize: 9 }}>{val}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="hud-bottom">
        {/* Controls guide */}
        <div className="hud-panel">
          <div className="label-xs" style={{ marginBottom: 6 }}>Controls</div>
          <div className="controls-guide">
            <div className="control-row"><span className="key">W A S D</span><span>Move</span></div>
            <div className="control-row"><span className="key">Space</span><span>Jump</span></div>
            <div className="control-row"><span className="key">Shift</span><span>Sprint</span></div>
            <div className="control-row"><span className="key">E</span><span>Interact</span></div>
            <div className="control-row"><span className="key">Click</span><span>Look</span></div>
            <div className="control-row"><span className="key">Esc</span><span>Pause</span></div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'auto', alignItems: 'flex-end' }}>
          <button
            id="hud-launch-btn"
            className="btn btn-amber"
            onClick={() => { sound.play('click'); onLaunch?.() }}
            title="Initiate launch sequence"
          >
            🔥 Launch Sequence
          </button>
          <button
            id="hud-exit-btn"
            className="btn btn-secondary"
            onClick={() => { sound.play('click'); onExitToMenu?.() }}
          >
            ← Exit to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
