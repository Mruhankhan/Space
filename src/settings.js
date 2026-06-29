// settings.js — persisted user settings (localStorage)
// Single source of truth for mouse sensitivity, FOV, invert Y,
// master volume, and graphics quality. Other modules subscribe to
// changes via `onChange` so a settings-menu slider can take effect
// immediately without remounting the renderer.
//
// Storage key: srbs_settings
// Schema:
//   {
//     mouseSensitivity: number  // 0.0005 – 0.02 (default 0.005)
//     fov: number               // 60 – 100 (default 70)
//     invertY: boolean          // default false
//     masterVolume: number      // 0 – 1 (default 0.3)
//     quality: 'low'|'medium'|'high' (default 'medium')
//   }

import { Vector3 } from 'three'

const STORAGE_KEY = 'srbs_settings'

export const QUALITY_PRESETS = Object.freeze({
  low:    { shadowMapSize: 512,  fogDensity: 0.020, pixelRatioCap: 1.0, stars: 600  },
  medium: { shadowMapSize: 1024, fogDensity: 0.012, pixelRatioCap: 1.5, stars: 1400 },
  high:   { shadowMapSize: 2048, fogDensity: 0.008, pixelRatioCap: 2.0, stars: 2200 },
})

const DEFAULTS = Object.freeze({
  mouseSensitivity: 0.005,
  fov: 70,
  invertY: false,
  masterVolume: 0.3,
  quality: 'medium',
})

function _clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function _normalize(raw) {
  const quality = QUALITY_PRESETS[raw?.quality] ? raw.quality : DEFAULTS.quality
  return {
    mouseSensitivity: _clamp(Number(raw?.mouseSensitivity ?? DEFAULTS.mouseSensitivity), 0.0005, 0.02),
    fov:              _clamp(Math.round(Number(raw?.fov ?? DEFAULTS.fov)), 60, 100),
    invertY:          Boolean(raw?.invertY ?? DEFAULTS.invertY),
    masterVolume:     _clamp(Number(raw?.masterVolume ?? DEFAULTS.masterVolume), 0, 1),
    quality,
  }
}

let _state = _normalize(_load())

function _load() {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return JSON.parse(raw)
  } catch {
    return { ...DEFAULTS }
  }
}

function _persist() {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)) } catch {}
}

const _listeners = new Set()

export const settings = {
  /** Returns a frozen copy of the current settings. */
  get() { return { ..._state } },

  /** Replace whole state (e.g. on menu save). */
  set(patch) {
    _state = _normalize({ ..._state, ...(patch || {}) })
    _persist()
    _notify()
    return { ..._state }
  },

  /** Patch individual keys without forcing a full re-emit if unchanged. */
  update(patch) {
    let changed = false
    const next = { ..._state }
    for (const k of Object.keys(patch)) {
      if (patch[k] !== undefined && patch[k] !== _state[k]) {
        next[k] = patch[k]
        changed = true
      }
    }
    if (!changed) return { ..._state }
    _state = _normalize(next)
    _persist()
    _notify()
    return { ..._state }
  },

  /** Subscribe to changes. Returns unsubscribe fn. */
  onChange(cb) {
    _listeners.add(cb)
    return () => _listeners.delete(cb)
  },

  reset() {
    _state = { ...DEFAULTS }
    _persist()
    _notify()
    return { ..._state }
  },

  defaults: DEFAULTS,
  presets: QUALITY_PRESETS,
}

function _notify() {
  const snap = { ..._state }
  for (const cb of _listeners) {
    try { cb(snap) } catch (e) { console.error('[settings] listener error', e) }
  }
}

// Reusable scratch.
export const _scratchVec = new Vector3()
