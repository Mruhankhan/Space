import React, { useRef } from 'react'
import { sound } from '../sound.js'

export default function HUD({ deck, position, onExitToMenu, onLaunch, insideRocket }) {
  const pos = position || { x: 0, y: 0, z: 0 }
  const lastTouchAction = useRef(0)

  function runAction(action) {
    sound.play('click')
    action?.()
  }

  function handleTouchAction(event, action) {
    if (event.pointerType !== 'touch') return
    event.preventDefault()
    lastTouchAction.current = performance.now()
    runAction(action)
  }

  function handleClickAction(action) {
    if (performance.now() - lastTouchAction.current < 500) return
    runAction(action)
  }

  return (
    <div className="hud">
      {/* Top-left status */}
      <div className="hud-top-left">
        <div className="hud-panel">
          {insideRocket ? (
            <div className="deck-indicator">
              <div className="deck-dot" />
              <div>
                <div className="label-xs">Current Deck</div>
                <div style={{
                  fontSize: 14,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--c-white)',
                  marginTop: 2,
                }}>
                  {deck || 'BOARDING...'}
                </div>
              </div>
            </div>
          ) : (
            <div className="label-xs" style={{ color: 'var(--c-muted)' }}>
              {deck || 'LAUNCHPAD · BAY ALPHA'}
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
            <div className="control-row"><span className="key">E</span><span>{insideRocket ? 'Deck / exit' : 'Board rocket'}</span></div>
            <div className="control-row"><span className="key">Click</span><span>Look</span></div>
            <div className="control-row"><span className="key">Esc</span><span>Pause</span></div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="hud-actions">
          <button
            id="hud-launch-btn"
            className="btn btn-amber"
            onPointerUp={(e) => handleTouchAction(e, onLaunch)}
            onClick={() => handleClickAction(onLaunch)}
            title="Initiate launch sequence"
          >
            🔥 Launch Sequence
          </button>
          <button
            id="hud-exit-btn"
            className="btn btn-secondary"
            onPointerUp={(e) => handleTouchAction(e, onExitToMenu)}
            onClick={() => handleClickAction(onExitToMenu)}
          >
            ← Exit to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
