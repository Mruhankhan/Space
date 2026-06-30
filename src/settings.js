// settings.js — persisted game settings with reactive onChange support

const STORAGE_KEY = 'srbs_settings'

const DEFAULTS = {
  sensitivity: 0.005,
  fov:         70,
  invertY:     false,
  volume:      0.3,
}

let _current = { ...DEFAULTS }
const _listeners = new Set()

// Load persisted values on module init
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  _current = { ...DEFAULTS, ...saved }
} catch {}

export const settings = {
  get() {
    return { ..._current }
  },

  set(partial) {
    _current = { ..._current, ...partial }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_current))
    } catch {}
    for (const cb of _listeners) {
      try { cb({ ..._current }) } catch {}
    }
  },

  /** Subscribe to all setting changes. Returns an unsubscribe function. */
  onChange(cb) {
    _listeners.add(cb)
    return () => _listeners.delete(cb)
  },
}
