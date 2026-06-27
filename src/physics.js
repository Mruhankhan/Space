// physics.js — lightweight AABB collision and character movement
// Uses Rapier3D if available, falls back to manual AABB

let _rapier = null
let _world = null
let _characterController = null

// Static collision boxes registered from world/rocket
const _staticBoxes = [] // { min: Vector3, max: Vector3 }

export const physics = {
  async init() {
    try {
      const RAPIER = await import('@dimforge/rapier3d-compat')
      await RAPIER.init()
      _rapier = RAPIER
      const gravity = { x: 0, y: -20, z: 0 }
      _world = new RAPIER.World(gravity)
      _characterController = _world.createCharacterController(0.05)
      _characterController.setSlideEnabled(true)
      _characterController.setApplyImpulsesToDynamicBodies(true)
      _characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180)
      console.log('[physics] Rapier initialised')
    } catch (e) {
      console.warn('[physics] Rapier unavailable, using AABB fallback', e)
      _rapier = null
    }
  },

  step(delta) {
    if (_world) {
      _world.timestep = delta
      _world.step()
    }
  },

  /** Register a static mesh's bounding box for AABB collision */
  addStatic(mesh) {
    if (!mesh.geometry) return
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox.clone()
    box.applyMatrix4(mesh.matrixWorld)
    _staticBoxes.push({ min: box.min.clone(), max: box.max.clone() })
  },

  /** Simple point-box overlap test */
  _overlaps(pos, r = 0.3) {
    for (const box of _staticBoxes) {
      if (
        pos.x + r > box.min.x && pos.x - r < box.max.x &&
        pos.y       > box.min.y && pos.y - 1.8 < box.max.y &&
        pos.z + r > box.min.z && pos.z - r < box.max.z
      ) return true
    }
    return false
  },

  /**
   * Move character with basic AABB collision
   * @param {THREE.Vector3} position - current position (mutated)
   * @param {THREE.Vector3} velocity - desired movement
   * @param {number} delta
   * @returns {{ grounded: boolean }}
   */
  characterMove(position, velocity, delta) {
    const STEPS = 3
    const dt = delta / STEPS
    let grounded = false

    for (let s = 0; s < STEPS; s++) {
      // X
      position.x += velocity.x * dt
      if (this._overlaps(position)) position.x -= velocity.x * dt

      // Z
      position.z += velocity.z * dt
      if (this._overlaps(position)) position.z -= velocity.z * dt

      // Y
      position.y += velocity.y * dt
      if (this._overlaps(position)) {
        if (velocity.y < 0) { grounded = true }
        velocity.y = 0
        position.y -= velocity.y * dt
        // snap to surface
        if (grounded) position.y = Math.round(position.y * 100) / 100
      }
    }

    return { grounded }
  },

  /**
   * Ground raycast — returns the Y surface under a position
   */
  groundY(position, maxDist = 8) {
    // Check against static floors: find the highest box below pos
    let best = -Infinity
    for (const box of _staticBoxes) {
      if (
        position.x >= box.min.x && position.x <= box.max.x &&
        position.z >= box.min.z && position.z <= box.max.z &&
        box.max.y <= position.y + 0.2
      ) {
        best = Math.max(best, box.max.y)
      }
    }
    return best === -Infinity ? -Infinity : best
  },

  clearStatic() {
    _staticBoxes.length = 0
  },
}
