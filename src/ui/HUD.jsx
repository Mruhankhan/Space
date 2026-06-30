import React, { memo, useRef, useCallback, useEffect, useState } from 'react'
import { sound } from '../sound.js'
import { input } from '../input.js'
import TouchJoystick from './TouchJoystick.jsx'

const ROCKET_POS = { x: 0, z: 0 }
const TOOLTIP_KEY = 'srbs_controls_tooltip_shown'

function useTooltipVisibility() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const shown = sessionStorage.getItem(TOOLTIP_KEY)
    if (!shown) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        sessionStorage.setItem(TOOLTIP_KEY, '1')
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [])
  return visible
}

function HUD({
  deck, position, onExitToMenu, onLaunch,
  insideRocket, launchReady, consoleProgress,
  forceTouch = false,
  consoleActivated = null,
  playerYaw = 0,
  mission = null,
}) {
  const pos = position || { x: 0, y: 0, z: 0 }
  const lastTouchAction = useRef(0)
  const tooltipVisible = useTooltipVisibility()

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

  // Compass using player yaw for camera-relative rotation.
  const dx = ROCKET_POS.x - pos.x
  const dz = ROCKET_POS.z - pos.z
  const worldAngle = Math.atan2(dx, -dz)
  const dist = Math.sqrt(dx * dx + dz * dz)
  const showCompass = !insideRocket && dist > 4

  // Camera-relative arrow angle.
  const arrowRot = ((worldAngle - playerYaw) * 180) / Math.PI

  return (
    <div className="hud">
      {/* Crosshair */}
      <div className="crosshair" aria-hidden="true">
        <div className="crosshair-ring" />
        <div className="crosshair-dot" />
      </div>

      {/* Console flash overlay */}
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

      {/* Top-left: Coords + Deck */}
      <div className="hud-top-left">
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
      </div>

      {/* Top-right: Mission */}
      <div className="hud-top-right">
        <div className="hud-panel" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
          <div className="label-xs">Mission</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--c-white)', marginTop: 2 }}>
            {mission?.label || 'Free Roam'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--c-muted)', marginTop: 4 }}>
            {consoleProgress}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: launchReady ? 'var(--c-success)' : 'var(--c-amber)' }}>
            {launchReady ? 'LAUNCH READY' : 'SYSTEMS CHECK'}
          </div>
        </div>
      </div>

      {/* Bottom-left: Compass + distance */}
      <div className="hud-bottom-left">
        {showCompass && (
          <div className="hud-panel rocket-compass" aria-hidden="true">
            <div className="label-xs" style={{ marginBottom: 4 }}>Rocket</div>
            <svg width="60" height="60" viewBox="-30 -30 60 60">
              <circle cx="0" cy="0" r="26" fill="rgba(0,0,0,0.4)" stroke="var(--c-cyan)" strokeWidth="1" />
              <g transform={`rotate(${arrowRot.toFixed(1)})`}>
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
      </div>

      {/* Bottom-right: Buttons */}
      <div className="hud-bottom-right">
        <button
          id="hud-launch-btn"
          className="btn btn-amber"
          onPointerUp={(e) => handleTouchAction(e, onLaunch)}
          onClick={() => handleClickAction(onLaunch)}
          title="Initiate launch sequence"
        >
          Launch Sequence
        </button>
        <button
          id="hud-exit-btn"
          className="btn btn-secondary"
          onPointerUp={(e) => handleTouchAction(e, onExitToMenu)}
          onClick={() => handleClickAction(onExitToMenu)}
        >
          Exit to Menu
        </button>
      </div>

      {/* Controls tooltip — shown once via sessionStorage */}
      {tooltipVisible && (
        <div className="hud-tooltip">
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
      )}
    </div>
  )
}

export default memo(HUD)


