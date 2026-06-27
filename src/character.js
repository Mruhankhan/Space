// character.js — Third-person astronaut character with movement and camera

import * as THREE from 'three'
import { input } from './input.js'
import { physics } from './physics.js'
import { getDeckForY, DECK_NAMES } from './rocket.js'

const WALK_SPEED  = 7
const SPRINT_MULT = 1.8
const JUMP_FORCE  = 8
const GRAVITY     = -20
const CAM_DIST    = 6
const CAM_HEIGHT  = 2
const CAM_SMOOTHING = 6
const DECK_HEIGHTS = [3.25, 10.25, 18.25]

// ── Astronaut model builder ───────────────────────────────
function buildAstronaut() {
  const group = new THREE.Group()

  const suitMat  = new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.6, metalness: 0.2 })
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.7, metalness: 0.5 })
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x002244, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.7 })
  const goldMat  = new THREE.MeshStandardMaterial({ color: 0xffcc44, roughness: 0.3, metalness: 0.8 })

  // Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), suitMat)
  body.position.y = 0.76
  body.castShadow = true
  group.add(body)

  // Head/helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), suitMat)
  helmet.position.y = 1.42
  helmet.castShadow = true
  group.add(helmet)

  // Visor
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14, 0, Math.PI * 1.2, 0.3, Math.PI * 0.55), visorMat)
  visor.position.set(0, 1.42, 0.06)
  group.add(visor)

  // Backpack (life support)
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.12), darkMat)
  pack.position.set(0, 0.85, -0.3)
  group.add(pack)

  // Gold visor strip
  const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16, 1, true, 0, Math.PI), goldMat)
  strip.position.set(0, 1.38, 0.1)
  strip.rotation.x = 0.2
  group.add(strip)

  // Arms
  for (const [side, x] of [['L', -0.36], ['R', 0.36]]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 4, 8), suitMat)
    arm.position.set(x, 0.82, 0)
    arm.rotation.z = side === 'L' ? 0.3 : -0.3
    arm.castShadow = true
    group.add(arm)
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), darkMat)
    glove.position.set(x + (side === 'L' ? -0.06 : 0.06), 0.55, 0)
    group.add(glove)
  }

  // Legs
  for (const [side, x] of [['L', -0.14], ['R', 0.14]]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 4, 8), suitMat)
    leg.position.set(x, 0.28, 0)
    group.add(leg)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.28), darkMat)
    boot.position.set(x, 0.06, 0.04)
    group.add(boot)
  }

  // Suit patches / insignia
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), new THREE.MeshStandardMaterial({ emissive: 0x0044cc, emissiveIntensity: 0.6 }))
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

    this.velocity = new THREE.Vector3()
    this.grounded = false
    this.insideRocket = false
    this.currentDeck = -1

    // Camera state
    this._camYaw   = 0   // horizontal angle
    this._camPitch = 0.3 // vertical angle
    this._camTarget = new THREE.Vector3()

    // Walk animation
    this._walkTime = 0
    this._legL = this.mesh.children.find(c => c.position.x < -0.1 && c.position.y < 0.4)
    this._legR = this.mesh.children.find(c => c.position.x > 0.1 && c.position.y < 0.4)

    // On-screen interaction hint callback
    this.onDeckChange = null
    this.onInteract   = null
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
  }

  /** Per-frame update. Returns current deck index (or -1). */
  update(delta, camera) {
    // ── Mouse look ──────────────────────────────────────────
    if (input.isPointerLocked()) {
      const delta_ = input.consumeMouseDelta()
      this._camYaw   -= delta_.x * 0.003
      this._camPitch -= delta_.y * 0.003
      this._camPitch  = Math.max(-0.6, Math.min(0.8, this._camPitch))
    }

    // ── Movement ────────────────────────────────────────────
    const mv = input.getMovement()
    const speed = WALK_SPEED * (input.isSprinting() ? SPRINT_MULT : 1)

    const forward = new THREE.Vector3(-Math.sin(this._camYaw), 0, -Math.cos(this._camYaw))
    const right   = new THREE.Vector3(-forward.z, 0, forward.x)

    const move = new THREE.Vector3()
    move.addScaledVector(forward, -mv.z)
    move.addScaledVector(right,    mv.x)
    if (move.length() > 0) {
      move.normalize().multiplyScalar(speed)
      this.mesh.rotation.y = this._camYaw + (mv.z !== 0 ? Math.atan2(mv.x, mv.z) : 0)
    }

    this.velocity.x = move.x
    this.velocity.z = move.z
    this.velocity.y += GRAVITY * delta

    // Jump
    if (this.grounded && input.isAction('jump')) {
      this.velocity.y = JUMP_FORCE
      this.grounded = false
    }

    // ── Physics / collision ─────────────────────────────────
    const result = physics.characterMove(this.mesh.position, this.velocity, delta)
    if (result.grounded) {
      this.grounded = true
      this.velocity.y = 0
    } else {
      // Ground snap
      const gy = physics.groundY(this.mesh.position)
      if (gy !== -Infinity && this.mesh.position.y <= gy + 0.15) {
        this.mesh.position.y = gy
        this.velocity.y = 0
        this.grounded = true
      } else {
        this.grounded = false
      }
    }

    // Prevent going below world floor
    if (this.mesh.position.y < 0) {
      this.mesh.position.y = 0
      this.velocity.y = 0
      this.grounded = true
    }

    // ── Walk animation ──────────────────────────────────────
    const moving = Math.abs(mv.x) + Math.abs(mv.z) > 0
    if (moving) {
      this._walkTime += delta * speed * 2.5
      const swing = Math.sin(this._walkTime) * 0.35
      if (this._legL) this._legL.rotation.x =  swing
      if (this._legR) this._legR.rotation.x = -swing
      this.mesh.position.y += Math.abs(Math.sin(this._walkTime)) * 0.005
    }

    // ── Interaction / deck detection ───────────────────────
    if (input.consumeAction('interact')) {
      if (this.insideRocket) {
        this._cycleRocketDeck()
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
    const camOffset = new THREE.Vector3(
      Math.sin(this._camYaw) * CAM_DIST,
      CAM_HEIGHT + Math.sin(this._camPitch) * CAM_DIST,
      Math.cos(this._camYaw) * CAM_DIST
    )

    const targetPos = this.mesh.position.clone().add(camOffset)
    this._camTarget.lerp(targetPos, delta * CAM_SMOOTHING)

    camera.position.copy(this._camTarget)
    camera.lookAt(this.mesh.position.clone().setY(this.mesh.position.y + 1.4))

    return this.currentDeck
  }

  /** Enter rocket — switch to interior mode */
  enterRocket() {
    this.insideRocket = true
    this.currentDeck  = -1
    this.mesh.position.set(0, DECK_HEIGHTS[0], 0)
    this.velocity.set(0, 0, 0)
    this.onDeckChange?.(DECK_NAMES[0])
  }

  /** Exit rocket */
  exitRocket() {
    this.insideRocket = false
    this.currentDeck  = -1
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
    this.mesh.position.set(0, DECK_HEIGHTS[nextDeck], 0)
    this.velocity.set(0, 0, 0)
    this.onDeckChange?.(DECK_NAMES[nextDeck])
  }

  dispose() {
    this.scene.remove(this.mesh)
  }
}
