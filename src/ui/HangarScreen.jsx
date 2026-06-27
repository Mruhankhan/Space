import React, { useState } from 'react'
import { getRockets, saveRocket } from '../save.js'
import { sound } from '../sound.js'

const COLORS = [
  { label: 'White',      hex: '#e8e8e8', accent: '#1a1a2e' },
  { label: 'Navy',       hex: '#0a2a5e', accent: '#00e5ff' },
  { label: 'Black',      hex: '#1a1a1a', accent: '#ffab00' },
  { label: 'Red',        hex: '#8b0000', accent: '#ff4444' },
  { label: 'Steel',      hex: '#607d8b', accent: '#cfd8dc' },
  { label: 'Midnight',   hex: '#0d1b2a', accent: '#00e5ff' },
  { label: 'Desert',     hex: '#c9a76c', accent: '#8b5e00' },
  { label: 'Forest',     hex: '#2e4a2e', accent: '#88cc44' },
]

export default function HangarScreen({ onBack, onTestFacility, onRocketChange }) {
  const [rockets, setRockets] = useState(getRockets)
  const [selected, setSelected] = useState(0)
  const [colorIdx, setColorIdx] = useState(0)

  const activeRocket = rockets[selected]

  function handleColorPick(idx) {
    sound.play('click')
    setColorIdx(idx)
    const updated = { ...activeRocket, color: COLORS[idx].hex, accentColor: COLORS[idx].accent }
    const newRockets = rockets.map((r, i) => i === selected ? updated : r)
    setRockets(newRockets)
    saveRocket(updated)
    onRocketChange?.(updated)
  }

  function handleSelectRocket(idx) {
    sound.play('click')
    setSelected(idx)
    const curColor = COLORS.findIndex(c => c.hex === rockets[idx].color)
    setColorIdx(curColor >= 0 ? curColor : 0)
    onRocketChange?.(rockets[idx])
  }

  return (
    <div className="screen-overlay hangar-screen">
      <div className="glass-panel hangar-panel">
        {/* Header */}
        <div className="hangar-header">
          <div>
            <div className="label-xs">Bay 01 · Orbital Staging</div>
            <h2 className="heading-sm" style={{ color: 'var(--c-white)', marginTop: 4 }}>Rocket Hangar</h2>
          </div>
          <button
            id="hangar-back-btn"
            className="btn btn-secondary"
            onClick={() => { sound.play('click'); onBack() }}
            style={{ padding: '8px 16px', fontSize: 11 }}
          >← Back</button>
        </div>

        {/* Rocket list */}
        <div>
          <div className="label-sm" style={{ marginBottom: 10 }}>Fleet</div>
          <div className="rocket-list">
            {rockets.map((r, i) => (
              <div
                key={r.id}
                id={`rocket-item-${r.id}`}
                className={`rocket-item ${i === selected ? 'selected' : ''}`}
                onClick={() => handleSelectRocket(i)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleSelectRocket(i)}
              >
                <div className="rocket-icon">🚀</div>
                <div className="rocket-info">
                  <div className="rocket-name">{r.name}</div>
                  <div className="rocket-spec">{r.description} · {r.stages} stage{r.stages > 1 ? 's' : ''}</div>
                </div>
                <div className="rocket-status" />
              </div>
            ))}
          </div>
        </div>

        {/* Paint section */}
        {activeRocket && (
          <div className="paint-section">
            <div className="label-sm">Paint Scheme</div>
            <div className="color-swatches">
              {COLORS.map((c, i) => (
                <div
                  key={c.label}
                  id={`color-swatch-${c.label.toLowerCase()}`}
                  className={`color-swatch ${i === colorIdx ? 'active' : ''}`}
                  style={{ background: c.hex, border: `2px solid ${i === colorIdx ? 'var(--c-cyan)' : 'transparent'}` }}
                  title={c.label}
                  onClick={() => handleColorPick(i)}
                  role="radio"
                  aria-checked={i === colorIdx}
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleColorPick(i)}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>
              Selected: <span style={{ color: 'var(--c-cyan)' }}>{COLORS[colorIdx].label}</span> · {activeRocket.name}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="hangar-actions">
          <button
            id="enter-facility-btn"
            className="btn btn-amber btn-full"
            onClick={() => { sound.play('click'); onTestFacility(activeRocket) }}
          >
            🏗️ Enter Test Facility
          </button>
          <button
            id="hangar-back-menu-btn"
            className="btn btn-secondary btn-full"
            onClick={() => { sound.play('click'); onBack() }}
          >
            ← Return to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
