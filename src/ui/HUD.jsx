import React, { memo, useRef, useCallback } from 'react'
import { sound } from '../sound.js'
import { input } from '../input.js'
import TouchJoystick from './TouchJoystick.jsx'

const ROCKET_POS = { x: 0, z: 0 }

function HUD({
  deck, position, onExitToMenu, onLaunch,
  insideRocket, launchReady, consoleProgress,
  forceTouch = false,
  consoleActivated = null,
}) {
  const pos = position || { x: 0, y: 0, z: 0 }
  const lastTouchAction = useRef(0)

  const runAction = useCallback((action) => {
    sound.play('click')
    action?.()
  }, [])

  const handleTouchAction = useCallback((event, action) => {
    if (event.pointerType !== 'touch') return
    event.preventDefault()
    lastTouchAction.current = performance.now()
    runAction(action)
  }, [runAction])

  const handleClickAction = useCallback((action) => {
    if (performance.now() - lastTouchAction.current < 500) return
    runAction(action)
  }, [runAction])

  const showTouch = forceTouch || input.isCoarsePointer()

  // Compass: angle from player to rocket in world space, converted to
  // camera-relative by subtracting the player's yaw.
  // For a simple arrow we just rotate by the world-space delta angle
  // (player rotates the camera, so the arrow stays world-fixed).
  const dx = ROCKET_POS.x - pos.x
  const dz = ROCKET_POS.z - pos.z
  const worldAngle = Math.atan2(dx, -dz)  // 0 = north, increasing clockwise
  const dist = Math.sqrt(dx * dx + dz * dz)
  // Arrow shown only when outside and rocket is far enough to need pointing.
  const showCompass = !insideRocket && dist > 4

  return (
    <div className="hud">
      {/* Crosshair */}
      <div className="crosshair" aria-hidden="true">
        <div className="crosshair-ring" />
        <div className="crosshair-dot" />
      </div>

      {/* Console flash overlay — quick cyan vignette when activated. */}
      {consoleActivated && (
        <div className="console-flash" key={consoleActivated + ':' + Date.now()} />
      )}

      {/* Touch joysticks */}
      {showTouch && (
        <div className="touch-controls">
          <TouchJoystick side="left" channel="move" />
          <TouchJoystick side="right" channel="look" />
        </div>
      )}

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
            <div style={{ marginTop: 8, fontSize: 10, color: launchReady ? 'var(--c-success)' : 'var(--c-amber)' }}>
              {consoleProgress}
            </div>
          </div>
        </div>
      </div>

      <div className="hud-bottom">
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

        {/* Rocket compass — small SVG arrow pointing at the rocket. */}
        {showCompass && (
          <div className="hud-panel rocket-compass" aria-hidden="true">
            <div className="label-xs" style={{ marginBottom: 4 }}>Rocket</div>
            <svg width="60" height="60" viewBox="-30 -30 60 60">
              <circle cx="0" cy="0" r="26" fill="rgba(0,0,0,0.4)" stroke="var(--c-cyan)" strokeWidth="1" />
              <g transform={`rotate(${(worldAngle * 180 / Math.PI).toFixed(1)})`}>
                <polygon
                  points="0,-18 8,8 0,4 -8,8"
                  fill="var(--c-cyan)"
                  stroke="var(--c-white)"
                  strokeWidth="0.5"
                />
              </g>
              <text x="0" y="36" textAnchor="middle" fill="var(--c-muted)" fontSize="7" fontFamily="var(--font-display)">
                {Math.round(dist)}m
              </text>
            </svg>
          </div>
        )}

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

export default memo(HUD)