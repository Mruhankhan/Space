// particles.js — Three.js Points-based particle system
// Engine fire, smoke plume, and ignition sparks — no external assets

import * as THREE from 'three'

let _scene = null
const _systems = []

// ── Internal helpers ───────────────────────────────────────
function _makeParticles({ count, spread, speed, color, size, lifetime, gravity = 0 }) {
  const positions = new Float32Array(count * 3)
  const velocities = []
  const lifetimes = []
  const maxLife = lifetime

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * spread
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.3
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread
    velocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      Math.random() * speed * 2,
      (Math.random() - 0.5) * speed
    ))
    lifetimes.push(Math.random() * maxLife)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const mat = new THREE.PointsMaterial({
    color, size, sizeAttenuation: true,
    transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const points = new THREE.Points(geo, mat)
  _scene.add(points)

  return { points, geo, velocities, lifetimes, maxLife, gravity, color, size, active: true }
}

function _updateSystem(sys, delta) {
  const pos = sys.geo.attributes.position.array
  for (let i = 0; i < sys.velocities.length; i++) {
    sys.lifetimes[i] -= delta
    if (sys.lifetimes[i] <= 0) {
      // respawn
      pos[i * 3]     = (Math.random() - 0.5) * 0.5
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5
      sys.velocities[i].set(
        (Math.random() - 0.5) * 2,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 2
      )
      sys.lifetimes[i] = sys.maxLife
    } else {
      pos[i * 3]     += sys.velocities[i].x * delta
      pos[i * 3 + 1] += sys.velocities[i].y * delta
      pos[i * 3 + 2] += sys.velocities[i].z * delta
      sys.velocities[i].y += sys.gravity * delta
    }
  }
  sys.geo.attributes.position.needsUpdate = true
  // fade opacity near end of life
  const avgLife = sys.lifetimes.reduce((a, b) => a + b, 0) / sys.lifetimes.length
  sys.points.material.opacity = Math.min(0.85, avgLife / sys.maxLife)
}

// ── Public API ─────────────────────────────────────────────
export const particles = {
  init(scene) { _scene = scene },

  startEngineFlare(rocketPosition) {
    const baseY = rocketPosition.y - 1

    // Bright core flame
    const flame = _makeParticles({
      count: 300, spread: 0.8, speed: 3,
      color: 0xffffff, size: 0.22,
      lifetime: 0.4, gravity: -2,
    })
    flame.points.position.copy(rocketPosition).setY(baseY)
    _systems.push(flame)

    // Orange outer cone
    const outer = _makeParticles({
      count: 400, spread: 1.5, speed: 2,
      color: 0xff6600, size: 0.35,
      lifetime: 0.7, gravity: -1,
    })
    outer.points.position.copy(rocketPosition).setY(baseY)
    _systems.push(outer)

    // Amber trailing
    const trail = _makeParticles({
      count: 200, spread: 2.0, speed: 1,
      color: 0xffaa00, size: 0.45,
      lifetime: 1.0, gravity: -0.5,
    })
    trail.points.position.copy(rocketPosition).setY(baseY)
    _systems.push(trail)
  },

  startSmokePlume(position) {
    const smoke = _makeParticles({
      count: 250, spread: 4, speed: 0.8,
      color: 0x556677, size: 1.2,
      lifetime: 3.5, gravity: 0.1,
    })
    smoke.points.position.copy(position)
    smoke.points.material.opacity = 0.3
    _systems.push(smoke)
  },

  startSparks(position) {
    const sparks = _makeParticles({
      count: 80, spread: 1.0, speed: 6,
      color: 0xffee88, size: 0.12,
      lifetime: 0.6, gravity: -15,
    })
    sparks.points.position.copy(position)
    _systems.push(sparks)
    // Auto-remove sparks after 2 seconds
    setTimeout(() => {
      _scene.remove(sparks.points)
      const idx = _systems.indexOf(sparks)
      if (idx >= 0) _systems.splice(idx, 1)
    }, 2000)
  },

  update(delta) {
    for (const sys of _systems) {
      if (sys.active) _updateSystem(sys, delta)
    }
  },

  stop() {
    for (const sys of _systems) {
      _scene.remove(sys.points)
    }
    _systems.length = 0
  },

  stopEngineFlare() {
    // Remove all fire systems (keep smoke)
    const toRemove = _systems.filter(s => s.points.material.color.getHex() !== 0x556677)
    toRemove.forEach(s => {
      _scene.remove(s.points)
      const idx = _systems.indexOf(s)
      if (idx >= 0) _systems.splice(idx, 1)
    })
  },
}
