// unlocks.js — localStorage-backed progression state.
// Tracks which colors / parts the pilot has earned through missions.

const STORAGE_KEY = 'srbs_unlocks'

// Order matters: lower index = unlocked earlier, higher = harder to earn.
const COLOR_UNLOCKS = [
  { label: 'White',    threshold: 0   },
  { label: 'Navy',     threshold: 0   },
  { label: 'Black',    threshold: 0   },
  { label: 'Red',      threshold: 100 },
  { label: 'Steel',    threshold: 200 },
  { label: 'Midnight', threshold: 350 },
  { label: 'Desert',   threshold: 500 },
  { label: 'Forest',   threshold: 700 },
]

const DEFAULT_STATE = Object.freeze({
  colors: COLOR_UNLOCKS.filter(c => c.threshold === 0).map(c => c.label),
  parts: { fairings: ['standard'], tanks: ['standard'] },
  highScore: 0,
  totalMissions: 0,
  totalSuccesses: 0,
})

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_STATE,
      ...parsed,
      parts: { ...DEFAULT_STATE.parts, ...(parsed.parts || {}) },
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function _save(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

export function loadUnlocks() { return _load() }
export function saveUnlocks(state) { _save(state) }
export function resetUnlocks() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
  return { ...DEFAULT_STATE }
}

export function isColorUnlocked(state, label) {
  return state.colors.includes(label)
}

export function lockedColors(state) {
  return COLOR_UNLOCKS.filter(c => !state.colors.includes(c.label))
}

// applyUnlock(state, score) → next state with newly-earned colors.
export function applyUnlock(state, score) {
  let changed = false
  const colors = [...state.colors]
  for (const c of COLOR_UNLOCKS) {
    if (score >= c.threshold && !colors.includes(c.label)) {
      colors.push(c.label)
      changed = true
    }
  }
  const next = {
    ...state,
    colors,
    highScore: Math.max(state.highScore || 0, score || 0),
  }
  if (changed) saveUnlocks(next)
  else _save(next)
  return next
}

export function recordMission(state, { success, score }) {
  const next = {
    ...state,
    totalMissions: (state.totalMissions || 0) + 1,
    totalSuccesses: (state.totalSuccesses || 0) + (success ? 1 : 0),
    highScore: Math.max(state.highScore || 0, score || 0),
  }
  _save(next)
  return next
}

export const ALL_COLORS = COLOR_UNLOCKS.map(c => c.label)
