// save.js — localStorage persistence for profile, rockets, and pilot log

const KEYS = {
  PROFILE: 'srbs_profile',
  ROCKETS: 'srbs_rockets',
  LOG:     'srbs_log',
}

const DEFAULT_ROCKETS = [
  {
    id: 'falcon9',
    name: 'Falcon-9 Mk1',
    template: 'falcon9',
    color: '#e8e8e8',
    accentColor: '#1a1a2e',
    stages: 2,
    description: '2-Stage Orbital Launcher',
  },
  {
    id: 'saturnv',
    name: 'Saturn V Legacy',
    template: 'saturnv',
    color: '#f5f5f0',
    accentColor: '#1a2a5e',
    stages: 3,
    description: '3-Stage Super Heavy Lifter',
  },
  {
    id: 'custom1',
    name: 'Explorer Custom',
    template: 'custom',
    color: '#003366',
    accentColor: '#00e5ff',
    stages: 2,
    description: '2-Stage Custom Config',
  },
]

// ── Profile ──────────────────────────────────────────────
export function getProfile() {
  try {
    const raw = localStorage.getItem(KEYS.PROFILE)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setProfile(profile) {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile))
}

// ── Rockets ──────────────────────────────────────────────
export function getRockets() {
  try {
    const raw = localStorage.getItem(KEYS.ROCKETS)
    return raw ? JSON.parse(raw) : DEFAULT_ROCKETS
  } catch { return DEFAULT_ROCKETS }
}

export function saveRocket(rocket) {
  const rockets = getRockets()
  const idx = rockets.findIndex(r => r.id === rocket.id)
  if (idx >= 0) rockets[idx] = rocket
  else rockets.push(rocket)
  localStorage.setItem(KEYS.ROCKETS, JSON.stringify(rockets))
}

// ── Pilot Log ─────────────────────────────────────────────
export function getLog() {
  try {
    const raw = localStorage.getItem(KEYS.LOG)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function addLogEntry(entry) {
  const log = getLog()
  log.unshift({ ...entry, timestamp: new Date().toISOString() })
  localStorage.setItem(KEYS.LOG, JSON.stringify(log.slice(0, 50)))
}
