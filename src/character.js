// character.js — capsule controller, instant third-person camera, all frame-based.
// Decoupled from React UI: emits events through a small subscriber list.

import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { input } from './input.js'
import { physics, CAPSULE_RADIUS, CAPSULE_TOTAL, PLAYER_EYE_OFFSET } from './physics.js'
import { getDeckForY, DECK_NAMES } from './rocket.js'

const WALK_SPEED       = 7.5
const SPRINT_MULT      = 1.55
const CROUCH_MULT      = 0.45
const ACCEL            = 70
const DECEL            = 90
const AIR_CONTROL      = 0.55
const JUMP_VELOCITY    = 7.2
const GRAVITY          = -22.0
const MAX_SLOPE_COS    = Math.cos(Math.PI / 4)

const COYOTE_TIME      = 0.12   // seconds after leaving ground you can still jump
const JUMP_BUFFER      = 0.14   // seconds before landing jump is buffered
const MOUSE_SENS       = 0.0024
const PAD_SENS         = 0.045
const CAMERA_HEIGHT    = 0.62   // above feet
const CAMERA_BACK      = 2.4
const MIN_PITCH        = -1.30
const MAX_PITCH        = 1.30

const DECK_HEIGHTS     = [3.25, 10.25, 18.25]

// ── Astronaut procedural mesh ─────────────────────────────
let _cachedMaterials = null
function getAstronautMaterials() {
  if (_cachedMaterials) return _cachedMaterials
  _cachedMaterials = {
    suit:   new MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.6, metalness: 0.2 }),
    dark:   new MeshStandardMaterial({ color: 0x223344, roughness: 0.7, metalness: 0.5 }),
    visor:  new MeshStandardMaterial({ color: 0x002244, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.75 }),
    gold:   new MeshStandardMaterial({ color: 0xffcc44, roughness: 0.3, metalness: 0.8 }),
    patch:  new MeshStandardMaterial({ emissive: 0x0044cc, emissiveIntensity: 0.6 }),
  }
  return _cachedMaterials
}

let _cachedGeometries = null
function getAstronautGeometries() {
  if (_cachedGeometries) return _cachedGeometries
  _cachedGeometries = {
    body:   new CapsuleGeometry(0.26, 0.5, 6, 12),
    helmet: new SphereGeometry(0.22, 14, 14),
    visor:  new SphereGeometry(0.19, 14, 14, 0, Math.PI * 1.2, 0.3, Math.PI * 0.55),
    pack:   new BoxGeometry(0.35, 0.4, 0.12),
    strip:  new CylinderGeometry(0.2, 0.2, 0.04, 16, 1, true, 0, Math.PI),
    arm:    new CapsuleGeometry(0.1, 0.38, 4, 8),
    glove:  new SphereGeometry(0.09, 8, 8),
    leg:    new CapsuleGeometry(0.12, 0.42, 4, 8),
    boot:   new BoxGeometry(0.18, 0.12, 0.28),
    patch:  new CircleGeometry(0.07, 8),
  }
  return _cachedGeometries
}

function buildAstronaut() {
  const m = getAstronautMaterials()
  const g = getAstronautGeometries()
  const group = new Group()

  const body = new Mesh(g.body, m.suit)
  body.position.y = 0.76
  body.castShadow = true
  group.add(body)

  const helmet = new Mesh(g.helmet, m.suit)
  helmet.position.y = 1.42
  helmet.castShadow = true
  group.add(helmet)

  const visor = new Mesh(g.visor, m.visor)
  visor.position.set(0, 1.42, 0.06)
  group.add(visor)

  const pack = new Mesh(g.pack, m.dark)
  pack.position.set(0, 0.85, -0.3)
  group.add(pack)

  const strip = new Mesh(g.strip, m.gold)
  strip.position.set(0, 1.38, 0.1)
  strip.rotation.x = 0.2
  group.add(strip)

  for (const [side, x] of [['L', -0.36], ['R', 0.36]]) {
    const arm = new Mesh(g.arm, m.suit)
    arm.position.set(x, 0.82, 0)
    arm.rotation.z = side === 'L' ? 0.3 : -0.3
    arm.castShadow = true
    group.add(arm)
    const glove = new Mesh(g.glove, m.dark)
    glove.position.set(x + (side === 'L' ? -0.06 : 0.06), 0.55, 0)
    group.add(glove)
  }

  let legL = null, legR = null
  for (const [side, x] of [['L', -0.14], ['R', 0.14]]) {
    const leg = new Mesh(g.leg, m.suit)
    leg.position.set(x, 0.28, 0)
    group.add(leg)
    if (side === 'L') legL = leg
    else legR = leg
    const boot = new Mesh(g.boot, m.dark)
    boot.position.set(x, 0.06, 0.04)
    group.add(boot)
  }

  const patch = new Mesh(g.patch, m.patch)
  patch.position.set(0.22, 0.9, 0.25)
  group.add(patch)

  group.userData.legL = legL
  group.userData.legR = legR
  return group
}

// ── Character controller ───────────────────────────────────
export class Character {
  constructor(scene) {
    this.scene = scene
    this.mesh = buildAstronaut()
    scene.add(this.mesh)

    this.position = new Vector3(0, 1, 0)  // feet position
    this.velocity = new Vector3()
    this.facing   = 0    // yaw of body
    this.grounded = false
    this.insideRocket = false
    this.currentDeck = -1
    this.currentDeckName = null

    this._yaw   = 0
    this._pitch = 0.18

    this._coyoteTimer = 0
    this._jumpBuffer  = 0
    this._walkPhase   = 0

    this._listeners = new Set()
  }

  on(name, fn) {
    this._listeners.add({ name, fn })
    return () => {
      for (const entry of this._listeners) {
        if (entry.name === name && entry.fn === fn) this._listeners.delete(entry)
      }
    }
  }
  _emit(name, payload) {
    for (const entry of this._listeners) {
      if (entry.name === name) {
        try { entry.fn(payload) } catch (e) { console.error(e) }
      }
    }
  }

  setFeet(x, y, z) {
    this.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
    this._syncMesh()
  }

  /** Place character at world position; syncs mesh immediately. */
  setPosition(x, y, z) { this.setFeet(x, y, z) }

  _syncMesh() {
    this.mesh.position.set(
      this.position.x,
      this.position.y - CAPSULE_TOTAL * 0.5,
      this.position.z,
    )
    this.mesh.rotation.y = this.facing
  }

  /**
   * Per-frame update.
   * Pipeline (matches renderer):
   *   1. read raw mouse + gamepad look input
   *   2. apply look to yaw/pitch instantly (no smoothing)
   *   3. read move axis, compute desired horizontal velocity
   *   4. integrate jump + gravity
   *   5. capsule move with sliding collision
   *   6. instant camera position (no lerp)
   */
  update(delta, rocket) {
    // ── 1. Look ─────────────────────────────────────────────
    const md = input.consumeMouseDelta()
    this._yaw   -= md.x * MOUSE_SENS
    const pl = input.getLookAxis()
    this._yaw   -= pl.x * PAD_SENS * delta
    this._pitch -= (md.y * MOUSE_SENS) + (pl.y * PAD_SENS * delta)
    if (this._pitch < MIN_PITCH) this._pitch = MIN_PITCH
    if (this._pitch > MAX_PITCH) this._pitch = MAX_PITCH

    // ── 2. Movement intent ──────────────────────────────────
    const axis = input.getMoveAxis()
    const sprinting = input.isSprinting()
    const speed = WALK_SPEED * (sprinting ? SPRINT_MULT : 1)

    const cosY = Math.cos(this._yaw)
    const sinY = Math.sin(this._yaw)
    // Forward in XZ plane for camera-relative move.
    const fx = -sinY
    const fz = -cosY
    const rx = -cosY
    const rz =  sinY

    let mx = axis.x * rx + axis.y * fx
    let mz = axis.x * rz + axis.y * fz
    const inputMag = Math.sqrt(mx * mx + mz * mz)
    if (inputMag > 1) { mx /= inputMag; mz /= inputMag }

    const desiredX = mx * speed
    const desiredZ = mz * speed

    // ── 3. Accelerate / decelerate (with air control) ────────
    const targetAccel = (inputMag > 0.05 ? ACCEL : DECEL) * (this.grounded ? 1 : AIR_CONTROL)
    const cur = this.velocity
    const dvx = desiredX - cur.x
    const dvz = desiredZ - cur.z
    const dvLen = Math.sqrt(dvx * dvx + dvz * dvz)
    const maxStep = targetAccel * delta
    if (dvLen > maxStep) {
      const k = maxStep / dvLen
      cur.x += dvx * k
      cur.z += dvz * k
    } else {
      cur.x = desiredX
      cur.z = desiredZ
    }

    // ── 4. Jump (with buffer + coyote time) ─────────────────
    if (input.consumeAction('jump') || input.isAction('jump')) {
      this._jumpBuffer = JUMP_BUFFER
    }
    if (this._jumpBuffer > 0) this._jumpBuffer -= delta
    if (!this.grounded) this._coyoteTimer -= delta
    if (this._jumpBuffer > 0 && (this.grounded || this._coyoteTimer > 0)) {
      this.velocity.y = JUMP_VELOCITY
      this.grounded = false
      this._coyoteTimer = 0
      this._jumpBuffer  = 0
    }

    // ── 5. Capsule move + sliding ───────────────────────────
    const moveResult = physics.characterMove(
      this.position,
      this.velocity,
      delta,
      { insideRocket: this.insideRocket, gravity: GRAVITY },
    )
    this.grounded = moveResult.grounded
    if (this.grounded) this._coyoteTimer = COYOTE_TIME

    // Hard world floor (never fall through map).
    if (this.position.y < -2) {
      this.position.y = 1
      this.velocity.set(0, 0, 0)
    }

    // ── 6. Walk animation + body yaw ────────────────────────
    const horizSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z)
    if (horizSpeed > 0.5) {
      this._walkPhase += delta * (horizSpeed / WALK_SPEED) * 8
      const swing = Math.sin(this._walkPhase) * 0.55
      if (this.mesh.userData.legL) this.mesh.userData.legL.rotation.x =  swing
      if (this.mesh.userData.legR) this.mesh.userData.legR.rotation.x = -swing
      // Body yaw blends toward move direction.
      const targetYaw = Math.atan2(-mz, -mx) + Math.PI
      const dy = ((targetYaw - this.facing + Math.PI) % (Math.PI * 2)) - Math.PI
      this.facing += dy * Math.min(1, delta * 12)
    } else {
      if (this.mesh.userData.legL) this.mesh.userData.legL.rotation.x = 0
      if (this.mesh.userData.legR) this.mesh.userData.legR.rotation.x = 0
    }

    this._syncMesh()

    // ── 7. Interactions (one-shot buttons) ──────────────────
    if (input.consumeAction('interact')) {
      this._handleInteract(rocket)
    }

    // ── 8. Deck change detection ────────────────────────────
    if (this.insideRocket) {
      const deck = getDeckForY(this.position.y)
      if (deck !== this.currentDeck) {
        const prev = this.currentDeck
        this.currentDeck = deck
        this.currentDeckName = DECK_NAMES[deck]
        this._emit('deck', { from: prev, to: deck, name: this.currentDeckName })
      }
    }

    return { grounded: this.grounded, insideRocket: this.insideRocket }
  }

  /**
   * Apply the camera transform for this frame.
   * Camera is third-person, behind+above the player, looking at head.
   * No lerp, no smoothing — instant response.
   */
  applyCamera(camera) {
    const cosP = Math.cos(this._pitch)
    const sinP = Math.sin(this._pitch)
    const cosY = Math.cos(this._yaw)
    const sinY = Math.sin(this._yaw)

    const eyeY = this.position.y + PLAYER_EYE_OFFSET * 0.85 + sinP * 0.6
    const camDist = CAMERA_BACK * cosP

    camera.position.set(
      this.position.x - sinY * camDist,
      eyeY,
      this.position.z - cosY * camDist,
    )

    const lookAtX = this.position.x - sinY * 1.0
    const lookAtY = this.position.y + PLAYER_EYE_OFFSET * 0.55 + sinP * 1.2
    const lookAtZ = this.position.z - cosY * 1.0
    camera.lookAt(lookAtX, lookAtY, lookAtZ)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = this._yaw
    camera.rotation.x = this._pitch
  }

  _handleInteract(rocket) {
    if (this.insideRocket) {
      // Try console activation first.
      if (rocket && this._tryActivateConsole(rocket)) return
      // Otherwise cycle deck.
      const next = this.currentDeck + 1
      if (next >= DECK_HEIGHTS.length) {
        this.exitRocket()
      } else {
        this.currentDeck = next
        this.currentDeckName = DECK_NAMES[next]
        this.setFeet(0, DECK_HEIGHTS[next], 0)
        this._emit('deck', { from: next - 1, to: next, name: this.currentDeckName })
      }
    } else {
      // Outside the rocket — board if standing near base.
      const dx = this.position.x
      const dz = this.position.z
      if (dx * dx + dz * dz < 4.0 && this.position.y < 3) {
        this.enterRocket()
      }
    }
  }



  enterRocket() {
    this.insideRocket = true
    this.currentDeck = 0
    this.currentDeckName = DECK_NAMES[0]
    this.setFeet(0, DECK_HEIGHTS[0], 0)
    this.facing = 0
    this._emit('deck', { from: -1, to: 0, name: this.currentDeckName })
  }

  exitRocket() {
    this.insideRocket = false
    this.currentDeck = -1
    this.currentDeckName = null
    this.setFeet(3.4, 0.6, 3.4)
    this._emit('deck', { from: 0, to: -1, name: null })
  }

  _tryActivateConsole(rocket) {
    const found = physics.collectInteractives(rocket, this.position, 1.9)
  
    if (!found.length) return false
    found.sort((a, b) => a.distance - b.distance)
    const id = found[0].obj.userData.consoleId
    this._emit('console', { consoleId: id })
    return true
  }

  dispose() {
    this.scene.remove(this.mesh)
    this._listeners.clear()
  }

  // Read-only accessors for UI broadcast.
snapshot() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      insideRocket: this.insideRocket,
      deck: this.currentDeckName,
    }
  }
}


