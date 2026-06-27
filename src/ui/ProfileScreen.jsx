import React, { useState } from 'react'
import { setProfile } from '../save.js'
import { sound } from '../sound.js'

export default function ProfileScreen({ onComplete }) {
  const [form, setForm] = useState({ name: '', age: '', callsign: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const e = {}
    if (!form.name.trim())     e.name     = 'Name is required'
    if (!form.age || isNaN(form.age) || +form.age < 1 || +form.age > 120)
                               e.age      = 'Enter a valid age (1–120)'
    if (!form.callsign.trim()) e.callsign = 'Callsign is required'
    if (form.callsign.length > 16) e.callsign = 'Max 16 characters'
    return e
  }

  function handleChange(e) {
    sound.play('hover')
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setErrors(er => ({ ...er, [e.target.name]: undefined }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    sound.resume()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); sound.play('error'); return }
    setSubmitting(true)
    const profile = { name: form.name.trim(), age: +form.age, callsign: form.callsign.trim().toUpperCase(), missions: 0 }
    setProfile(profile)
    sound.play('success')
    setTimeout(() => onComplete(profile), 800)
  }

  return (
    <div className="screen-overlay profile-screen">
      <div className="glass-panel profile-card">
        <div className="profile-header">
          <span className="badge">PILOT REGISTRATION — FLIGHT CLASS 1</span>
          <h1 className="profile-title">Create Pilot Profile</h1>
          <p className="profile-subtitle">
            Enter your details to begin your career as a rocket engineer and test pilot.
          </p>
        </div>

        <form className="profile-fields" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="pilot-name">Full Name</label>
            <input
              id="pilot-name"
              name="name"
              type="text"
              placeholder="e.g. Neil Armstrong"
              value={form.name}
              onChange={handleChange}
              autoComplete="off"
            />
            {errors.name && <span className="error">{errors.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="pilot-age">Age</label>
            <input
              id="pilot-age"
              name="age"
              type="number"
              placeholder="e.g. 28"
              value={form.age}
              onChange={handleChange}
              min={1} max={120}
            />
            {errors.age && <span className="error">{errors.age}</span>}
          </div>

          <div className="field">
            <label htmlFor="pilot-callsign">Pilot Callsign</label>
            <input
              id="pilot-callsign"
              name="callsign"
              type="text"
              placeholder="e.g. EAGLE, PHOENIX, NOVA"
              value={form.callsign}
              onChange={handleChange}
              autoComplete="off"
              maxLength={16}
            />
            <span className="hint">This is your identity in mission logs. 1–16 characters.</span>
            {errors.callsign && <span className="error">{errors.callsign}</span>}
          </div>

          <button
            id="profile-submit-btn"
            type="submit"
            className={`btn btn-primary btn-lg btn-full ${submitting ? 'submitting' : ''}`}
            disabled={submitting}
            onClick={() => sound.play('click')}
          >
            {submitting ? '⏳ Initialising...' : '🚀 BEGIN MISSION'}
          </button>
        </form>
      </div>
    </div>
  )
}
