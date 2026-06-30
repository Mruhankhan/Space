import React, { useEffect, useState } from 'react'
import { settings } from '../settings.js'
import { sound } from '../sound.js'

export default function SettingsMenu({ onClose }) {
  const [vals, setVals] = useState(() => settings.get())

  // Sync state if settings change externally
  useEffect(() => {
    const unsub = settings.onChange(v => setVals({ ...v }))
    return unsub
  }, [])

  function update(key, value) {
    const patch = { [key]: value }
    settings.set(patch)
    setVals(v => ({ ...v, ...patch }))
    // Live volume feedback
    if (key === 'volume') sound.setMasterVolume(value)
  }

  return (
    <div className="screen-overlay settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="glass-panel settings-panel">
        {/* Header */}
        <div className="settings-header">
          <div>
            <div className="label-xs">Configuration</div>
            <h2 className="heading-sm" style={{ color: 'var(--c-white)', marginTop: 4 }}>Settings</h2>
          </div>
          <button
            id="settings-close-btn"
            className="btn btn-secondary"
            onClick={() => { sound.play('click'); onClose?.() }}
            style={{ padding: '8px 16px', fontSize: 11 }}
          >
            ✕ Close
          </button>
        </div>

        <div className="settings-divider" />

        {/* Mouse Sensitivity */}
        <div className="settings-row">
          <label htmlFor="settings-sensitivity" className="settings-label">
            Mouse Sensitivity
            <span className="settings-value">{vals.sensitivity.toFixed(4)}</span>
          </label>
          <input
            id="settings-sensitivity"
            type="range"
            className="settings-slider"
            min={0.001}
            max={0.01}
            step={0.0001}
            value={vals.sensitivity}
            onChange={e => update('sensitivity', parseFloat(e.target.value))}
          />
          <div className="settings-range-labels">
            <span>0.001 (slow)</span>
            <span>0.01 (fast)</span>
          </div>
        </div>

        {/* FOV */}
        <div className="settings-row">
          <label htmlFor="settings-fov" className="settings-label">
            Field of View
            <span className="settings-value">{Math.round(vals.fov)}°</span>
          </label>
          <input
            id="settings-fov"
            type="range"
            className="settings-slider"
            min={60}
            max={100}
            step={1}
            value={vals.fov}
            onChange={e => update('fov', parseFloat(e.target.value))}
          />
          <div className="settings-range-labels">
            <span>60° (narrow)</span>
            <span>100° (wide)</span>
          </div>
        </div>

        {/* Invert Y */}
        <div className="settings-row settings-row--inline">
          <label htmlFor="settings-inverty" className="settings-label" style={{ margin: 0 }}>
            Invert Y Axis
          </label>
          <label className="settings-toggle" htmlFor="settings-inverty">
            <input
              id="settings-inverty"
              type="checkbox"
              checked={vals.invertY}
              onChange={e => update('invertY', e.target.checked)}
            />
            <span className="settings-toggle-track">
              <span className="settings-toggle-thumb" />
            </span>
          </label>
        </div>

        {/* Master Volume */}
        <div className="settings-row">
          <label htmlFor="settings-volume" className="settings-label">
            Master Volume
            <span className="settings-value">{Math.round(vals.volume * 100)}%</span>
          </label>
          <input
            id="settings-volume"
            type="range"
            className="settings-slider"
            min={0}
            max={1}
            step={0.01}
            value={vals.volume}
            onChange={e => update('volume', parseFloat(e.target.value))}
          />
          <div className="settings-range-labels">
            <span>Mute</span>
            <span>Max</span>
          </div>
        </div>

        <div className="settings-divider" />

        <div style={{ fontSize: 11, color: 'var(--c-muted)', textAlign: 'center' }}>
          Changes apply immediately · Press Esc to close
        </div>
      </div>
    </div>
  )
}
