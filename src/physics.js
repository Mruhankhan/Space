// physics.js — capsule controller + swept collision with 8x8 grid broadphase
// Static collision world is partitioned into an 8x8 grid for O(1) queries.

import { Vector3 } from 'three'

// ── Capsule geometry (player) ──────────────────────────────
export const CAPSULE_RADIUS  = 0.34
export const CAPSULE_HEIGHT  = 1.55
export const CAPSULE_TOTAL   = CAPSULE_HEIGHT + CAPSULE_RADIUS * 2

export const PLAYER_EYE_OFFSET = CAPSULE_TOTAL * 0.85

const MAX_SLOPE = Math.cos(Math.PI / 4)
const SKIN      = 0.015

// ── Grid config ─────────────────────────────────────────────
const GRID_CX = 8
const GRID_CZ = 8
const GRID_MIN_X = -250
const GRID_MIN_Z = -250
const GRID_MAX_X = 250
const GRID_MAX_Z = 250
const CELL_W = (GRID_MAX_X - GRID_MIN_X) / GRID_CX  // 62.5
const CELL_D = (GRID_MAX_Z - GRID_MIN_Z) / GRID_CZ  // 62.5

// ── Static collision world ─────────────────────────────────
const _world = {
  spheres: [],
  boxes:   [],
  floors:  [],
  shells:  [],
  grid:    [],
}

let _nearby = { boxes: [], floors: [] }

// Reusable scratch vectors.
const _v1 = new Vector3()
const _v2 = new Vector3()
const _v3 = new Vector3()
const _v4 = new Vector3()

function _cellCoord(x, z) {
  const cx = Math.max(0, Math.min(GRID_CX - 1, Math.floor((x - GRID_MIN_X) / CELL_W)))
  const cz = Math.max(0, Math.min(GRID_CZ - 1, Math.floor((z - GRID_MIN_Z) / CELL_D)))
  return { x: cx, z: cz }
}

function _addToGrid(entry, type) {
  const { x: xMin, z: zMin } = _cellCoord(entry.minX, entry.minZ)
  const { x: xMax, z: zMax } = _cellCoord(entry.maxX, entry.maxZ)
  for (let cx = xMin; cx <= xMax; cx++) {
    for (let cz = zMin; cz <= zMax; cz++) {
      const idx = cx + cz * GRID_CX
      if (!_world.grid[idx]) _world.grid[idx] = []
      _world.grid[idx].push({ entry, type })
    }
  }
}

function _getNearby(px, pz) {
  const { x: cx, z: cz } = _cellCoord(px, pz)
  const boxSet = new Set()
  const floorSet = new Set()
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const nx = cx + dx
      const nz = cz + dz
      if (nx < 0 || nx >= GRID_CX || nz < 0 || nz >= GRID_CZ) continue
      const cell = _world.grid[nx + nz * GRID_CX]
      if (!cell) continue
      for (const item of cell) {
        if (item.type === 'floor') floorSet.add(item.entry)
        else boxSet.add(item.entry)
      }
    }
  }
  return { boxes: [...boxSet], floors: [...floorSet] }
}

export const physics = {
  async init() {},

  step() { /* continuous collision handled in characterMove */ },

  clearStatic() {
    _world.spheres.length = 0
    _world.boxes.length   = 0
    _world.floors.length  = 0
    _world.shells.length  = 0
    _world.grid.length    = 0
  },

  addStatic(mesh, options = {}) {
    if (!mesh) return
    mesh.updateWorldMatrix(true, false)
    const geom = mesh.geometry
    if (!geom) return
    geom.computeBoundingBox()
    const box = geom.boundingBox
    if (!box) return
    const min = box.min.clone().applyMatrix4(mesh.matrixWorld)
    const max = box.max.clone().applyMatrix4(mesh.matrixWorld)
    const entry = {
      minX: min.x, minY: min.y, minZ: min.z,
      maxX: max.x, maxY: max.y, maxZ: max.z,
    }
    const tag = options.tag || (options.ignoreWhenInside ? 'shell' : 'box')
    if (tag === 'shell') _world.shells.push(entry)
    else if (tag === 'floor') {
      _world.floors.push(entry)
      _addToGrid(entry, 'floor')
    } else {
      _world.boxes.push(entry)
      _addToGrid(entry, 'box')
    }
  },

  addFloorBox(minX, minY, minZ, maxX, maxY, maxZ) {
    const entry = { minX, minY, minZ, maxX, maxY, maxZ }
    _world.floors.push(entry)
    _addToGrid(entry, 'floor')
  },

  characterMove(feet, velocity, delta, options = {}) {
    const insideRocket = !!options.insideRocket
    const gravity      = options.gravity !== undefined ? options.gravity : -22.0

    const r = CAPSULE_RADIUS
    const halfHeight = CAPSULE_HEIGHT * 0.5

    const cx = feet.x
    const cy = feet.y + r + halfHeight
    const cz = feet.z

    // Update broadphase neighbourhood once per frame.
    _nearby = _getNearby(feet.x, feet.z)

    velocity.y += gravity * delta

    const dx = velocity.x * delta
    const dy = velocity.y * delta
    const dz = velocity.z * delta

    let grounded = false
    let groundY  = feet.y

    if (dx !== 0) {
      const hit = this._sphereSlideAxis(cx, cy, cz, dx, 0, 0, r, halfHeight, insideRocket)
      if (hit.moved) {
        feet.x = hit.x
      } else {
        const stepResult = this._tryStepUp(cx, cy, cz, dx, dz, r, halfHeight, insideRocket)
        if (stepResult.moved) {
          feet.x = stepResult.x
          feet.z = stepResult.z
          feet.y = stepResult.y
        } else {
          velocity.x = 0
        }
      }
    }

    if (dz !== 0) {
      const hit = this._sphereSlideAxis(feet.x, feet.y + r + halfHeight, feet.z, 0, 0, dz, r, halfHeight, insideRocket)
      if (hit.moved) {
        feet.z = hit.z
      } else {
        velocity.z = 0
      }
    }

    const newCx = feet.x
    const newCyStart = feet.y + r + halfHeight
    const newCz = feet.z
    if (dy !== 0) {
      const hit = this._sphereSlideAxis(newCx, newCyStart, newCz, 0, dy, 0, r, halfHeight, insideRocket)
      if (hit.moved) {
        feet.y = hit.y - (r + halfHeight)
        if (dy < 0) {
          grounded = true
          groundY = feet.y
          velocity.y = 0
        } else {
          velocity.y = 0
        }
      } else {
        feet.y = hit.y - (r + halfHeight)
        if (dy < 0) { grounded = true; groundY = feet.y }
        velocity.y = 0
      }
    }

    if (!grounded) {
      const snap = this._groundProbe(feet.x, feet.y + r + halfHeight, feet.z, r, halfHeight, insideRocket)
      if (snap.hit) {
        const surface = snap.y
        if (feet.y >= surface - SKIN && feet.y <= surface + 0.4 && velocity.y <= 0) {
          feet.y = surface
          velocity.y = 0
          grounded = true
          groundY = surface
        }
      }
    }

    return { grounded, groundY, velocity }
  },

  groundY(feet, insideRocket = false) {
    const r = CAPSULE_RADIUS
    const halfHeight = CAPSULE_HEIGHT * 0.5
    const cx = feet.x
    const cy = feet.y + r + halfHeight
    const cz = feet.z
    let best = -Infinity
    const probe = this._groundProbe(cx, cy, cz, r, halfHeight, insideRocket)
    if (probe.hit) best = probe.y
    return best === -Infinity ? -Infinity : best
  },

  _sphereSlideAxis(cx, cy, cz, dx, dy, dz, r, halfHeight, insideRocket) {
    let x = cx, y = cy, z = cz
    let moved = false

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (len < 1e-6) return { moved: false, x, y, z }

    let remaining = Math.abs(len)
    const stepLen = r * 0.5
    const sign = { x: dx === 0 ? 0 : (dx > 0 ? 1 : -1),
                   y: dy === 0 ? 0 : (dy > 0 ? 1 : -1),
                   z: dz === 0 ? 0 : (dz > 0 ? 1 : -1) }

    for (let i = 0; i < 6 && remaining > 1e-5; i++) {
      const step = Math.min(stepLen, remaining)
      const tx = x + sign.x * step
      const ty = y + sign.y * step
      const tz = z + sign.z * step

      const top    = { x: tx, y: ty + halfHeight, z: tz }
      const bottom = { x: tx, y: ty - halfHeight, z: tz }

      let hitBox = null
      let hitSphere = null
      let hitDist = Infinity

      const lists = [_nearby.boxes]
      for (const list of lists) {
        for (let j = 0; j < list.length; j++) {
          const b = list[j]
          if (this._sphereBoxOverlap(b, top, r) || this._sphereBoxOverlap(b, bottom, r)) {
            const d = this._sphereBoxPenetration(b, top, bottom, r, halfHeight)
            if (d.dist < hitDist) {
              hitDist = d.dist
              hitBox = b
              hitSphere = d.sphere
              moved = true
            }
          }
        }
      }

      if (!hitBox) {
        x = tx; y = ty; z = tz
        remaining -= step
        continue
      }

      const normal = this._resolvePenetrationNormal(hitBox, hitSphere, r)
      if (Math.abs(normal.x) > 0.001) {
        x = tx + sign.x * step + normal.x * (hitDist + SKIN)
      } else {
        x = tx + sign.x * step
      }
      if (Math.abs(normal.y) > 0.001) {
        y = ty + sign.y * step + normal.y * (hitDist + SKIN)
      } else {
        y = ty + sign.y * step
      }
      if (Math.abs(normal.z) > 0.001) {
        z = tz + sign.z * step + normal.z * (hitDist + SKIN)
      } else {
        z = tz + sign.z * step
      }

      const vDotN = sign.x * normal.x + sign.y * normal.y + sign.z * normal.z
      if (vDotN < 0) {
        const newSign = {
          x: sign.x - normal.x * vDotN,
          y: sign.y - normal.y * vDotN,
          z: sign.z - normal.z * vDotN,
        }
        const newLen = Math.sqrt(newSign.x * newSign.x + newSign.y * newSign.y + newSign.z * newSign.z)
        if (newLen > 1e-5) {
          sign.x = newSign.x / newLen
          sign.y = newSign.y / newLen
          sign.z = newSign.z / newLen
          if (Math.abs(sign.x * normal.x + sign.y * normal.y + sign.z * normal.z) > 0.95) break
          remaining = Math.min(remaining, len * 0.9)
        } else {
          break
        }
      }
      remaining = Math.min(remaining, len * 0.9)
    }

    return { moved, x, y, z }
  },

  _sphereBoxOverlap(box, sphere, r) {
    const cx = Math.max(box.minX, Math.min(sphere.x, box.maxX))
    const cy = Math.max(box.minY, Math.min(sphere.y, box.maxY))
    const cz = Math.max(box.minZ, Math.min(sphere.z, box.maxZ))
    const dx = sphere.x - cx
    const dy = sphere.y - cy
    const dz = sphere.z - cz
    return (dx * dx + dy * dy + dz * dz) < (r * r)
  },

  _sphereBoxPenetration(box, top, bottom, r, halfHeight) {
    let best = null
    let bestDist = Infinity
    for (const sphere of [top, bottom]) {
      const cx = Math.max(box.minX, Math.min(sphere.x, box.maxX))
      const cy = Math.max(box.minY, Math.min(sphere.y, box.maxY))
      const cz = Math.max(box.minZ, Math.min(sphere.z, box.maxZ))
      const dx = sphere.x - cx
      const dy = sphere.y - cy
      const dz = sphere.z - cz
      const d2 = dx * dx + dy * dy + dz * dz
      const d  = Math.sqrt(d2)
      const pen = r - d
      if (pen > 0 && pen < bestDist) {
        bestDist = pen
        best = { sphere }
      }
    }
    return { dist: best ? bestDist : 0, sphere: best ? best.sphere : null }
  },

  _resolvePenetrationNormal(box, sphere, r) {
    const cx = Math.max(box.minX, Math.min(sphere.x, box.maxX))
    const cy = Math.max(box.minY, Math.min(sphere.y, box.maxY))
    const cz = Math.max(box.minZ, Math.min(sphere.z, box.maxZ))
    const dx = sphere.x - cx
    const dy = sphere.y - cy
    const dz = sphere.z - cz
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 < 1e-8) {
      const dxMax = Math.min(sphere.x - box.minX, box.maxX - sphere.x)
      const dyMax = Math.min(sphere.y - box.minY, box.maxY - sphere.y)
      const dzMax = Math.min(sphere.z - box.minZ, box.maxZ - sphere.z)
      if (dxMax <= dyMax && dxMax <= dzMax) return { x: sphere.x < (box.minX + box.maxX) * 0.5 ? -1 : 1, y: 0, z: 0 }
      if (dyMax <= dzMax) return { x: 0, y: sphere.y < (box.minY + box.maxX) * 0.5 ? -1 : 1, z: 0 }
      return { x: 0, y: 0, z: sphere.z < (box.minZ + box.maxZ) * 0.5 ? -1 : 1 }
    }
    const inv = 1.0 / Math.sqrt(d2)
    return { x: dx * inv, y: dy * inv, z: dz * inv }
  },

  _tryStepUp(cx, cy, cz, dx, dz, r, halfHeight, insideRocket) {
    const STEP_UP   = 0.4
    const tryY = cy + STEP_UP
    const newCx = cx + dx
    const newCz = cz + dz
    const top    = { x: newCx, y: tryY + halfHeight, z: newCz }
    const bottom = { x: newCx, y: tryY - halfHeight, z: newCz }
    let blocked = false
    for (const b of _nearby.boxes) {
      if (this._sphereBoxOverlap(b, top, r) || this._sphereBoxOverlap(b, bottom, r)) {
        blocked = true
        break
      }
    }
    if (blocked) return { moved: false, x: cx, y: cy, z: cz }
    const probe = this._groundProbe(newCx, tryY, newCz, r, halfHeight, insideRocket)
    if (!probe.hit) return { moved: false, x: cx, y: cy, z: cz }
    const newFeet = probe.y
    if (newFeet - (tryY - r - halfHeight) > STEP_UP + 0.1) return { moved: false, x: cx, y: cy, z: cz }
    return { moved: true, x: newCx, y: newFeet, z: newCz }
  },

  _groundProbe(cx, cy, cz, r, halfHeight, insideRocket) {
    const startY = cy - halfHeight
    const endY   = startY - 0.6
    let best = null

    const lists = insideRocket ? [_nearby.boxes, _nearby.floors] : [_nearby.floors, _nearby.boxes]
    for (const list of lists) {
      for (let j = 0; j < list.length; j++) {
        const b = list[j]
        if (cx + r < b.minX || cx - r > b.maxX) continue
        if (cz + r < b.minZ || cz - r > b.maxZ) continue
        if (b.maxY < endY) continue
        if (b.maxY > startY + r) continue
        const surfaceY = b.maxY
        if (!best || surfaceY > best.y) best = { hit: true, y: surfaceY, box: b }
      }
    }

    for (const b of _nearby.boxes) {
      if (cx + r < b.minX || cx - r > b.maxX) continue
      if (cz + r < b.minZ || cz - r > b.maxZ) continue
      const topY = b.maxY
      if (topY >= startY - 0.05 && topY <= startY + 0.55) {
        if (!best || topY > best.y) best = { hit: true, y: topY, box: b }
      }
    }

    if (!best) return { hit: false, y: 0 }
    return best
  },

  raycast(originX, originY, originZ, dirX, dirY, dirZ, maxDist) {
    let bestT = maxDist
    let bestNormal = null
    let bestPoint = null
    const lists = [_world.boxes, _world.floors]
    for (const list of lists) {
      for (let i = 0; i < list.length; i++) {
        const b = list[i]
        let tMin = -Infinity, tMax = bestT
        const o = [originX, originY, originZ]
        const d = [dirX, dirY, dirZ]
        const minB = [b.minX, b.minY, b.minZ]
        const maxB = [b.maxX, b.maxY, b.maxZ]
        let hit = true
        for (let k = 0; k < 3; k++) {
          if (Math.abs(d[k]) < 1e-8) {
            if (o[k] < minB[k] || o[k] > maxB[k]) { hit = false; break }
          } else {
            let t1 = (minB[k] - o[k]) / d[k]
            let t2 = (maxB[k] - o[k]) / d[k]
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp }
            if (t1 > tMin) tMin = t1
            if (t2 < tMax) tMax = t2
            if (tMin > tMax) { hit = false; break }
          }
        }
        if (hit && tMin > 0 && tMin < bestT) {
          bestT = tMin
          bestPoint = {
            x: originX + dirX * tMin,
            y: originY + dirY * tMin,
            z: originZ + dirZ * tMin,
          }
          const eps = 1e-3
          bestNormal = { x: 0, y: 0, z: 0 }
          if (Math.abs(bestPoint.x - b.minX) < eps) bestNormal.x = -1
          else if (Math.abs(bestPoint.x - b.maxX) < eps) bestNormal.x = 1
          else if (Math.abs(bestPoint.y - b.minY) < eps) bestNormal.y = -1
          else if (Math.abs(bestPoint.y - b.maxY) < eps) bestNormal.y = 1
          else if (Math.abs(bestPoint.z - b.minZ) < eps) bestNormal.z = -1
          else if (Math.abs(bestPoint.z - b.maxZ) < eps) bestNormal.z = 1
        }
      }
    }
    if (!bestPoint) return null
    return { t: bestT, point: bestPoint, normal: bestNormal }
  },

  insideTrigger(x, y, z, radius, yMin, yMax) {
    return (x * x + z * z) < (radius * radius) && y >= yMin && y <= yMax
  },

  collectInteractives(rocket, playerPos, range) {
    const result = []
    if (!rocket) return result
    rocket.traverse(obj => {
      if (!obj.userData) return
      if (obj.userData.isConsole) {
        obj.getWorldPosition(_v1)
        const dx = _v1.x - playerPos.x
        const dy = _v1.y - playerPos.y
        const dz = _v1.z - playerPos.z
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d < range) result.push({ obj, distance: d })
      }
    })
    return result
  },
}
