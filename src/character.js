// character.js — Third-person astronaut character with movement and camera

import {
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  CapsuleGeometry,
  BoxGeometry,
  CylinderGeometry,
  Vector3,
} from 'three'
import { input } from './input.js'
import { physics } from './physics.js'
import { getDeckForY, DECK_NAMES } from './rocket.js'

const WALK_SPEED      = 9
const SPRINT_MULT     = 2.2
const JUMP_FORCE      = 8
const GRAVITY         = -20
const ACCELERATION    = 48
const DECELERATION    = 70
const CAM_DIST        = 5.8
const CAM_HEIGHT      = 2
const CAM_SMOOTHING   = 10
const MIN_CAM_PITCH   = -0.6
const MAX_CAM_PITCH   = 0.8
const DECK_HEIGHTS = [3.25, 10.25, 18.25]

// ── Astronaut model builder ───────────────────────────────
function buildAstronaut() {
  const group = new Group()
 
  const suitMat  = new MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.6, metalness: 0.2 })
  const darkMat  = new MeshStandardMaterial({ color: 0x223344, roughness: 0.7, metalness: 0.5 })
  const visorMat = new MeshStandardMaterial({ color: 0x002244, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.7 })
  const goldMat  = new MeshStandardMaterial({ color: 0xffcc44, roughness: 0.3, metalness: 0.8 })
 
  // Body
  const body = new Mesh(new CapsuleGeometry(0.26, 0.5, 6, 12), suitMat)
  body.position.y = 0.76
  body.castShadow = true
  group.add(body)

  // Head/helmet
  const helmet = new Mesh(new SphereGeometry(0.22, 14, 14), suitMat)
  helmet.position.y = 1.42
  helmet.castShadow = true
  group.add(helmet)

  // Visor
  const visor = new Mesh(new SphereGeometry(0.19, 14, 14, 0, Math.PI * 1.2, 0.3, Math.PI * 0.55), visorMat)
  visor.position.set(0, 1.42, 0.06)
  group.add(visor)

  // Backpack (life support)
  const pack = new Mesh(new BoxGeometry(0.35, 0.4, 0.12), darkMat)
  pack.position.set(0, 0.85, -0.3)
  group.add(pack)

  // Gold visor strip
  const strip = new Mesh(new CylinderGeometry(0.2, 0.2, 0.04, 16, 1, true, 0, Math.PI), goldMat)
  strip.position.set(0, 1.38, 0.1)
  strip.rotation.x = 0.2
  group.add(strip)

  // Arms
  for (const [side, x] of [['L', -0.36], ['R', 0.36]]) {
    const arm = new Mesh(new CapsuleGeometry(0.1, 0.38, 4, 8), suitMat)
    arm.position.set(x, 0.82, 0)
    arm.rotation.z = side === 'L' ? 0.3 : -0.3
    arm.castShadow = true
    group.add(arm)
    const glove = new Mesh(new SphereGeometry(0.09, 8, 8), darkMat)
    glove.position.set(x + (side === 'L' ? -0.06 : 0.06), 0.55, 0)
    group.add(glove)
  }

  // Legs
  for (const [side, x] of [['L', -0.14], ['R', 0.14]]) {
    const leg = new Mesh(new CapsuleGeometry(0.12, 0.42, 4, 8), suitMat)
    leg.position.set(x, 0.28, 0)
    group.add(leg)
    const boot = new Mesh(new BoxGeometry(0.18, 0.12, 0.28), darkMat)
    boot.position.set(x, 0.06, 0.04)
    group.add(boot)
  }

  // Suit patches / insignia
  const patch = new Mesh(new CircleGeometry(0.07, 8), new MeshStandardMaterial({ emissive: 0x0044cc, emissiveIntensity: 0.6 }))
  patch.position.set(0.22, 0.9, 0.25)
  group.add(patch)

  return group
}

// ── Character controller ───────────────────────────────────
export class Character {
  constructor(scene) {
    this.scene = scene
    this.mesh = buildAstronaut()
    this.mesh.scale.setScalar(1.0)
    scene.add(this.mesh)

    this.velocity = new Vector3()
    this.grounded = false
    this.insideRocket = false
    this.currentDeck = -1

    // Camera state
    this._camYaw   = 0   // horizontal angle
    this._camPitch = 0.3 // vertical angle
    this._camTarget = new Vector3()
    this._cameraLookAt = new Vector3()

    // Movement helper vectors reused each frame for performance
    this._forward = new Vector3()
    this._right = new Vector3()
    this._move = new Vector3()
    this._desiredVelocity = new Vector3()
    this._currentVelocityXZ = new Vector3()
    this._velocityDelta = new Vector3()
    this._camOffset = new Vector3()
    this._targetPos = new Vector3()
    this._tempWorldPos = new Vector3()

    // Walk animation
    this._walkTime = 0
    this._legL = this.mesh.children.find(c => c.position.x < -0.1 && c.position.y < 0.4)
    this._legR = this.mesh.children.find(c => c.position.x > 0.1 && c.position.y < 0.4)

    // On-screen interaction hint callback
    this.onDeckChange = null
    this.onConsoleActivate = null
    this.currentDeckName = null
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
  }

  /** Per-frame update. Returns current deck index (or -1). */
  update(delta, camera, rocket) {
    // ── Look input ──────────────────────────────────────────
    const lookDelta = { x: 0, y: 0 }
    if (input.isPointerLocked()) {
      const mouseDelta = input.consumeMouseDelta()
      lookDelta.x += mouseDelta.x
      lookDelta.y += mouseDelta.y
    }
    const gamepadLook = input.getLookDelta()
    lookDelta.x += gamepadLook.x
    lookDelta.y += gamepadLook.y

    this._camYaw   -= lookDelta.x * 0.005
    this._camPitch -= lookDelta.y * 0.005
    this._camPitch  = Math.max(MIN_CAM_PITCH, Math.min(MAX_CAM_PITCH, this._camPitch))

    // ── Movement ────────────────────────────────────────────
    const mv = input.getMovement()
    const targetSpeed = WALK_SPEED * (input.isSprinting() ? SPRINT_MULT : 1)

    this._forward.set(-Math.sin(this._camYaw), 0, -Math.cos(this._camYaw))
    this._right.set(-this._forward.z, 0, this._forward.x)

    this._move.set(0, 0, 0)
    this._move.addScaledVector(this._forward, -mv.z)
    this._move.addScaledVector(this._right, mv.x)
    if (this._move.lengthSq() > 0.0001) {
      this._move.normalize().multiplyScalar(targetSpeed)
    }

    this._currentVelocityXZ.set(this.velocity.x, 0, this.velocity.z)
    this._desiredVelocity.copy(this._move)
    this._velocityDelta.subVectors(this._desiredVelocity, this._currentVelocityXZ)

    const maxChange = (this._desiredVelocity.lengthSq() > 0.001 ? ACCELERATION : DECELERATION) * delta
    if (this._velocityDelta.length() > maxChange) {
      this._velocityDelta.setLength(maxChange)
    }
    this._currentVelocityXZ.add(this._velocityDelta)

    if (this._currentVelocityXZ.lengthSq() < 0.01 && this._desiredVelocity.lengthSq() < 0.01) {
      this._currentVelocityXZ.set(0, 0, 0)
    }

    this.velocity.x = this._currentVelocityXZ.x
    this.velocity.z = this._currentVelocityXZ.z
    this.velocity.y += GRAVITY * delta

    if (this._move.lengthSq() > 0.0001) {
      this.mesh.rotation.y = this._camYaw + Math.atan2(mv.x, mv.z)
    }

    // Jump
    if (this.grounded && input.isAction('jump')) {
      this.velocity.y = JUMP_FORCE
      this.grounded = false
    }

    // ── Physics / collision ─────────────────────────────────
    const result = physics.characterMove(this.mesh.position, this.velocity, delta, { insideRocket: this.insideRocket })
    if (result.grounded) {
      this.grounded = true
      this.velocity.y = 0
    } else {
      const gy = physics.groundY(this.mesh.position)
      if (gy !== -Infinity && this.mesh.position.y <= gy + 0.15) {
        this.mesh.position.y = gy
        this.velocity.y = 0
        this.grounded = true
      } else {
        this.grounded = false
      }
    }

    if (this.mesh.position.y < 0) {
      this.mesh.position.y = 0
      this.velocity.y = 0
      this.grounded = true
    }

    // ── Walk animation ──────────────────────────────────────
    const moving = Math.abs(this._desiredVelocity.x) + Math.abs(this._desiredVelocity.z) > 0
    if (moving) {
      this._walkTime += delta * (1 + this._currentVelocityXZ.length() / WALK_SPEED) * 4
      const swing = Math.sin(this._walkTime) * 0.35
      if (this._legL) this._legL.rotation.x = swing
      if (this._legR) this._legR.rotation.x = -swing
      this.mesh.position.y += Math.abs(Math.sin(this._walkTime)) * 0.005
    }

    if (input.consumeAction('interact')) {
      if (this.insideRocket) {
        if (!this._tryActivateConsole(rocket)) {
          this._cycleRocketDeck()
        }
      } else if (Math.hypot(this.mesh.position.x, this.mesh.position.z) < 2.6 && this.mesh.position.y < 4) {
        this.enterRocket()
      }
    }

    if (this.insideRocket && this.onDeckChange) {
      const deck = getDeckForY(this.mesh.position.y)
      if (deck !== this.currentDeck) {
        this.currentDeck = deck
        this.onDeckChange(DECK_NAMES[deck])
      }
    }

    // ── Camera follow ───────────────────────────────────────
    this._camOffset.set(
      Math.sin(this._camYaw) * CAM_DIST,
      CAM_HEIGHT + Math.sin(this._camPitch) * CAM_DIST,
      Math.cos(this._camYaw) * CAM_DIST
    )

    this._targetPos.copy(this.mesh.position).add(this._camOffset)
    this._camTarget.lerp(this._targetPos, Math.min(1, delta * CAM_SMOOTHING))

    camera.position.copy(this._camTarget)
    this._cameraLookAt.copy(this.mesh.position).setY(this.mesh.position.y + 1.4)
    camera.lookAt(this._cameraLookAt)

    return this.currentDeck
  }

  /** Enter rocket — switch to interior mode */
  enterRocket() {
    this.insideRocket = true
    this.currentDeck  = 0
    this.currentDeckName = DECK_NAMES[0]
    this.mesh.position.set(0, DECK_HEIGHTS[0], 0)
    this.velocity.set(0, 0, 0)
    this.onDeckChange?.(this.currentDeckName)
  }

  /** Exit rocket */
  exitRocket() {
    this.insideRocket = false
    this.currentDeck  = -1
    this.currentDeckName = null
    this.mesh.position.set(3.2, 0.4, 3.2)
    this.velocity.set(0, 0, 0)
    this.onDeckChange?.(null)
  }

  _cycleRocketDeck() {
    const nextDeck = this.currentDeck < 0 ? 0 : this.currentDeck + 1
    if (nextDeck >= DECK_HEIGHTS.length) {
      this.exitRocket()
      return
    }

    this.currentDeck = nextDeck
    this.currentDeckName = DECK_NAMES[nextDeck]
    this.mesh.position.set(0, DECK_HEIGHTS[nextDeck], 0)
    this.velocity.set(0, 0, 0)
    this.onDeckChange?.(this.currentDeckName)
  }

  _tryActivateConsole(rocket) {
    if (!rocket) return false

    let closest = null
    let shortestDist = 1.8
    rocket.traverse(obj => {
      if (!obj.userData.isConsole) return
      const worldPos = obj.getWorldPosition(this._tempWorldPos)
      const distance = worldPos.distanceTo(this.mesh.position)
      if (distance < shortestDist) {
        shortestDist = distance
        closest = obj
      }
    })

    if (!closest) return false
    this.onConsoleActivate?.(closest.userData.consoleId)
    return true
  }

  dispose() {
    this.scene.remove(this.mesh)
  }
}
