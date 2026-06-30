import React, { memo } from 'react'
import { settings } from '../settings.js'
import { sound } from '../sound.js'

const LABELS = {
  mouseSensitivity: ['Mouse Sensitivity', '0.0005 – 0.02'],
  fov: ['Field of View', '60° – 100°'],
  masterVolume: ['Master Volume', '0 – 100%'],
}

function Slider({ name, value, min, max, step, onChange }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <label style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--c-cyan)' }}>
          {LABELS[name]?.[0] || name}
        </label>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--c-white)' }}>
          {name === 'fov' ? `${Math.round(value)}°` : name === 'masterVolume' ? `${Math.round(value * 100)}%` : value.toFixed(4)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(name, parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: 4,
          cursor: 'pointer',
          appearance: 'none',
          background: `linear-gradient(90deg, var(--c-cyan) ${pct}%, rgba(0,229,255,0.1) ${pct}%)`,
          borderRadius: 2,
          outline: 'none',
        }}
      />
    </div>
  )
}

function SettingsMenu({ onClose }) {
  const [state, setState] = React.useState(() => settings.get())

  const handleChange = React.useCallback((key, value) => {
    const next = { ...state, [key]: value }
    setState(next)
    settings.update({ [key]: value })
    if (key === 'masterVolume') sound.setMasterVolume(value)
  }, [state])

  const handleToggleInvertY = React.useCallback(() => {
    handleChange('invertY', !state.invertY)
  }, [state, handleChange])

  return (
    <div className="screen-overlay" style={{ background: 'rgba(2,12,27,0.88)', zIndex: 40 }}>
      <div className="glass-panel" style={{ width: 'min(420px, 90vw)', padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="heading-sm" style={{ fontSize: 18, letterSpacing: 3 }}>Settings</div>
          <button
            className="btn btn-secondary"
            onClick={() => { sound.play('click'); onClose?.() }}
            style={{ padding: '8px 16px', fontSize: 11 }}
          >
            Close
          </button>
        </div>

        <Slider name="mouseSensitivity" value={state.mouseSensitivity} min={0.0005} max={0.02} step={0.0001} onChange={handleChange} />
        <Slider name="fov" value={state.fov} min={60} max={100} step={1} onChange={handleChange} />
        <Slider name="masterVolume" value={state.masterVolume} min={0} max={1} step={0.05} onChange={handleChange} />

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: 'var(--c-cyan)',
          }}
        >
          <input
            type="checkbox"
            checked={state.invertY}
            onChange={handleToggleInvertY}
            style={{ width: 16, height: 16, accentColor: 'var(--c-cyan)', cursor: 'pointer' }}
          />
          Invert Y-Axis
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary btn-full"
            onClick={() => { settings.reset(); setState(settings.get()) }}
            style={{ fontSize: 11 }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(SettingsMenu)
