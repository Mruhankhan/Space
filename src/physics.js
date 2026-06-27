// physics.js — lightweight AABB collision and character movement

// Static collision boxes registered from world/rocket
const _staticBoxes = [] // { min: Vector3, max: Vector3, ignoreWhenInside: boolean }

export const physics = {
  async init() {
    console.log('[physics] Lightweight AABB collision ready')
  },

  step(delta) {
    // Static AABB collision does not need a world step.
  },

  /** Register a static mesh's bounding box for AABB collision */
  addStatic(mesh, options = {}) {
    if (!mesh.geometry) return
    mesh.updateWorldMatrix(true, false)
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox.clone()
    box.applyMatrix4(mesh.matrixWorld)
    _staticBoxes.push({
      min: box.min.clone(),
      max: box.max.clone(),
      ignoreWhenInside: !!options.ignoreWhenInside,
    })
  },

  /** Simple point-box overlap test */
  _overlaps(pos, r = 0.3, insideRocket = false) {
    for (const box of _staticBoxes) {
      if (insideRocket && box.ignoreWhenInside) continue
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
  characterMove(position, velocity, delta, options = {}) {
    const STEPS = 3
    const dt = delta / STEPS
    let grounded = false
    const insideRocket = !!options.insideRocket

    for (let s = 0; s < STEPS; s++) {
      // X
      const dx = velocity.x * dt
      position.x += dx
      if (this._overlaps(position, 0.3, insideRocket)) position.x -= dx

      // Z
      const dz = velocity.z * dt
      position.z += dz
      if (this._overlaps(position, 0.3, insideRocket)) position.z -= dz

      // Y
      const dy = velocity.y * dt
      position.y += dy
      if (this._overlaps(position, 0.3, insideRocket)) {
        if (velocity.y < 0) { grounded = true }
        position.y -= dy
        velocity.y = 0
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