import React from 'react'
import { sound } from '../sound.js'
import { getLog } from '../save.js'

const NAV = [
  { id: 'start',    icon: '🚀', label: 'Start Game',           hint: 'Continue your mission' },
  { id: 'hangar',   icon: '🛸', label: 'Rocket Hangar',        hint: 'Design & manage rockets' },
  { id: 'facility', icon: '🏗️',  label: 'Test Facility',       hint: 'Walk the launch complex' },
  { id: 'log',      icon: '📋', label: 'Pilot Log',             hint: 'Review past missions', isDivider: true },
]

export default function MainMenu({ profile, activeItem, onNavigate }) {
  const log = getLog()
  const initials = (profile?.callsign || '??').slice(0, 2)

  return (
    <div className="screen-overlay main-menu">
      <div className="main-menu-content">
        {/* Logo */}
        <div className="menu-logo">
          <span className="agency">⬡ ORBITAL SYSTEMS — SECTOR 7</span>
          <h1 className="title">SPACE ROCKET<br/>BUILDER</h1>
        </div>

        {/* Pilot card */}
        {profile && (
          <div className="pilot-card" id="pilot-info-card">
            <div className="pilot-avatar">{initials}</div>
            <div className="pilot-info">
              <div className="pilot-callsign">PILOT: {profile.callsign}</div>
              <div className="pilot-meta">{profile.name} · Age {profile.age} · {log.length} mission{log.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="menu-nav" aria-label="Main navigation">
          {NAV.map((item) => (
            <React.Fragment key={item.id}>
              {item.isDivider && <div style={{ height: 1, background: 'rgba(0,229,255,0.08)', margin: '4px 0' }} />}
              <button
                id={`menu-btn-${item.id}`}
                className={`menu-btn ${activeItem === item.id ? 'active' : ''} ${item.id === 'facility' ? 'highlight' : ''}`}
                onClick={() => { sound.play('click'); sound.resume(); onNavigate(item.id) }}
                onMouseEnter={() => sound.play('hover')}
                aria-label={item.label}
              >
                <span className="icon" aria-hidden="true">{item.icon}</span>
                <span>
                  <div>{item.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.5, fontFamily: 'Inter, sans-serif', letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>{item.hint}</div>
                </span>
              </button>
            </React.Fragment>
          ))}
        </nav>

        {/* Footer */}
        <div className="menu-footer">
          Space Rocket Builder Simulator v0.1.0 · Milestone 1
        </div>
      </div>
    </div>
  )
}
