import React, { useEffect, useRef, useState } from 'react'
import { sound } from '../sound.js'

// ── Controls tooltip — shown once per session ─────────────
const TOOLTIP_KEY = 'srbs_controls_shown'

function ControlsTooltip() {
  const [opacity, setOpacity] = useState(1)
  const [mounted, setMounted] = useState(true)

  // Only show once per session
  if (sessionStorage.getItem(TOOLTIP_KEY)) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    sessionStorage.setItem(TOOLTIP_KEY, '1')
    // Fade out after 8 seconds
    const fadeTimer = setTimeout(() => {
      setOpacity(0)
    }, 8000)
    // Unmount after fade completes
    const removeTimer = setTimeout(() => {
      setMounted(false)
    }, 9200)
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer) }
  }, [])

  if (!mounted) return null

  return (
    <div
      className="hud-controls-tooltip"
      style={{ opacity, transition: 'opacity 1.2s ease' }}
      aria-live="polite"
    >
      <div className="label-xs" style={{ marginBottom: 8 }}>Controls</div>
      <div className="controls-guide">
        <div className="control-row"><span className="key">W A S D</span><span>Move</span></div>
        <div className="control-row"><span className="key">Space</span><span>Jump</span></div>
        <div className="control-row"><span className="key">Shift</span><span>Sprint</span></div>
        <div className="control-row"><span className="key">E</span><span>Interact</span></div>
        <div className="control-row"><span className="key">Click</span><span>Look</span></div>
        <div className="control-row"><span className="key">Esc</span><span>Settings</span></div>
      </div>
    </div>
  )
}

// ── Compass + Distance panel ───────────────────────────────
function CompassPanel({ playerYaw, rocketPos, playerPos }) {
  // rocketPos and playerPos are {x, z} world coords
  // playerYaw is the camera yaw angle in radians (from character._camYaw)
  // Arrow should point from player toward the rocket, relative to camera direction.

  let angle = 0
  let distance = 0

  if (rocketPos && playerPos) {
    const dx = rocketPos.x - playerPos.x
    const dz = rocketPos.z - playerPos.z
    distance = Math.sqrt(dx * dx + dz * dz)
    // World angle to rocket
    const worldAngle = Math.atan2(dx, dz)
    // Relative to camera yaw (playerYaw is the camera's horizontal angle)
    angle = worldAngle - (playerYaw || 0)
  }

  const arrowStyle = {
    transform: `rotate(${angle}rad)`,
    display: 'inline-block',
    fontSize: 18,
    transition: 'transform 0.1s linear',
    color: 'var(--c-cyan)',
  }

  return (
    <div className="hud-panel hud-compass-panel">
      <div className="label-xs" style={{ marginBottom: 4 }}>Rocket</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={arrowStyle}>↑</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--c-cyan)' }}>
          {distance < 1 ? 'AT' : `${Math.round(distance)}m`}
        </span>
      </div>
    </div>
  )
}

// ── Main HUD ──────────────────────────────────────────────
export default function HUD({
  deck,
  interactionPrompt,
  onExitToMenu,
  onLaunch,
  insideRocket,
  playerYaw,
  playerPos,
  paused,
}) {
  // Rocket is always at world origin (0, 0)
  const rocketPos = { x: 0, z: 0 }

  return (
    <div className="hud" aria-label="HUD overlay">
      {/* ── Top-left: Coordinates + deck name ── */}
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
          <div id="hud-coords" className="coords">
            X 0.0 &nbsp; Y 0.0 &nbsp; Z 0.0
          </div>
        </div>
      </div>

      {/* ── Top-right: Mission objective ── */}
      <div className="hud-top-right">
        <div className="hud-panel" style={{ alignItems: 'flex-end' }}>
          <div className="label-xs">Mission Objective</div>
          <div style={{
            fontSize: 11,
            fontFamily: 'var(--font-display)',
            color: 'var(--c-amber)',
            marginTop: 3,
            letterSpacing: 1,
          }}>
            {insideRocket
              ? 'Inspect rocket systems and initiate launch'
              : 'Board the rocket and prepare for launch'}
          </div>
        </div>
      </div>

      {/* ── Interaction Prompt (centre) ── */}
      {interactionPrompt && (
        <div className="interaction-prompt">
          <span className="key">E</span>
          <span>{interactionPrompt}</span>
        </div>
      )}

      {/* ── Bottom-left: Compass + distance ── */}
      <div className="hud-bottom-left">
        <ControlsTooltip />
        {!insideRocket && (
          <CompassPanel
            playerYaw={playerYaw}
            rocketPos={rocketPos}
            playerPos={playerPos}
          />
        )}
      </div>

      {/* ── Bottom-right: Launch + Exit buttons ── */}
      <div className="hud-bottom-right">
        <div className="hud-actions">
          <button
            id="hud-launch-btn"
            className="btn btn-amber"
            onClick={() => { sound.play('click'); onLaunch?.() }}
            title="Initiate launch sequence"
            disabled={!!paused}
          >
            🔥 Launch Sequence
          </button>
          <button
            id="hud-exit-btn"
            className="btn btn-secondary"
            onClick={() => { sound.play('click'); onExitToMenu?.() }}
            disabled={!!paused}
          >
            ← Exit to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
