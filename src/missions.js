// missions.js — randomized mission objectives + scoring.
// Pure functions; no DOM, no game.js coupling.

const TYPES = [
  {
    id: 'altitude',
    label: 'Reach Target Altitude',
    describe: (m) => `Climb to ${m.threshold} m.`,
    threshold: () => 1500 + Math.floor(Math.random() * 2000),
    score: (alt, m) => Math.round((alt / m.threshold) * 100),
  },
  {
    id: 'velocity',
    label: 'Hold Velocity',
    describe: (m) => `Sustain ${m.threshold} m/s for ${Math.round(m.threshold / 50)} s of flight.`,
    threshold: () => 200 + Math.floor(Math.random() * 6) * 50,
    score: (alt, m) => Math.round((alt > 0 ? m.threshold : 0) / 10),
  },
  {
    id: 'duration',
    label: 'Survive Burn Time',
    describe: (m) => `Keep flying for ${m.threshold} s.`,
    threshold: () => 12 + Math.floor(Math.random() * 8),
    score: (alt, m) => Math.round(Math.min(alt, m.threshold * 80) / (m.threshold * 0.8)),
  },
]

function _hashSeed(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function _pickType(seed) {
  return TYPES[seed % TYPES.length]
}

// generateMission({ rocketId, runIndex }) → frozen mission object.
export function generateMission({ rocketId, runIndex = 0 } = {}) {
  const seed = _hashSeed(`${rocketId || 'default'}-${runIndex}-${Date.now()}`)
  const t = _pickType(seed)
  const m = {
    id: `${t.id}-${seed.toString(36)}`,
    type: t.id,
    label: t.label,
    describe: t.describe({ threshold: t.threshold() }),
    threshold: t.threshold(),
    seed,
  }
  return Object.freeze(m)
}

// scoreMission({ altitude, flightTime, success }, mission) → { score, tier, label }.
export function scoreMission(result, mission) {
  if (!mission) return { score: 0, tier: 'fail', label: 'No mission' }
  const alt = result?.altitude || 0
  const t = TYPES.find(x => x.id === mission.type)
  let raw = 0
  if (t) {
    try { raw = t.score(alt, mission) } catch { raw = 0 }
  }
  if (!result?.success) raw = Math.min(raw, 25)
  const score = Math.max(0, Math.min(1000, Math.round(raw)))
  let tier = 'fail'
  if (score >= 600)      tier = 'gold'
  else if (score >= 350) tier = 'silver'
  else if (score >= 150) tier = 'bronze'
  return { score, tier, label: mission.label }
}

export const MISSION_TYPES = TYPES
