// rocket.js — Procedural rocket geometry generator with walkable interior

import * as THREE from 'three'

// ── Material helpers ───────────────────────────────────────
function metalMat(color = 0xd0d8e0, roughness = 0.35, metalness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}
function emissiveMat(color, emissive, intensity = 0.8) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.6, metalness: 0.3 })
}

// ── Build exterior ─────────────────────────────────────────
function buildExterior(config, group) {
  const bodyColor = new THREE.Color(config.color || '#e8e8e8')
  const accentColor = new THREE.Color(config.accentColor || '#1a1a2e')

  // Nose cone
  const noseCone = new THREE.Mesh(
    new THREE.ConeGeometry(1.0, 4, 24),
    metalMat(bodyColor.getHex())
  )
  noseCone.position.y = 22
  noseCone.castShadow = true
  group.add(noseCone)

  // Payload fairing (upper body)
  const fairing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 6, 24),
    metalMat(bodyColor.getHex())
  )
  fairing.position.y = 17
  fairing.castShadow = true
  group.add(fairing)

  // Stage 1 tank (main body)
  const tank1 = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 12, 24),
    metalMat(bodyColor.getHex())
  )
  tank1.position.y = 8
  tank1.castShadow = true
  tank1.receiveShadow = true
  group.add(tank1)

  // Interstage ring
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.4, 24),
    metalMat(accentColor.getHex())
  )
  ring.position.y = 14
  group.add(ring)

  // Stage 2 tank (if multi-stage)
  if (config.stages >= 2) {
    const tank2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 8, 24),
      metalMat(bodyColor.getHex())
    )
    tank2.position.y = 18.5
    tank2.castShadow = true
    group.add(tank2)
  }

  // Engine section
  const engineMount = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.2, 1.5, 24),
    metalMat(0x444455)
  )
  engineMount.position.y = 1.5
  group.add(engineMount)

  // Engine bells (3 or 9 depending on template)
  const bellCount = config.template === 'falcon9' ? 9 : config.template === 'saturnv' ? 5 : 3
  const bellRadius = config.template === 'falcon9' ? 0.7 : 0.5
  for (let i = 0; i < bellCount; i++) {
    const angle = (i / bellCount) * Math.PI * 2
    const x = Math.sin(angle) * bellRadius
    const z = Math.cos(angle) * bellRadius
    const bell = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.8, 12),
      metalMat(0x333344)
    )
    bell.rotation.z = Math.PI
    bell.position.set(x, 0.2, z)
    group.add(bell)
  }

  // Grid fins (Falcon 9 style)
  if (config.template === 'falcon9') {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.2, 1.2),
        metalMat(0x666677)
      )
      fin.position.set(Math.sin(angle) * 1.1, 12, Math.cos(angle) * 1.1)
      fin.rotation.y = angle
      group.add(fin)
    }
  }

  // Landing legs
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 2.5, 0.08),
      metalMat(0x555566)
    )
    leg.position.set(Math.sin(angle) * 1.4, 1.25, Math.cos(angle) * 1.4)
    leg.rotation.z = Math.sin(angle) * 0.35
    leg.rotation.x = Math.cos(angle) * 0.35
    group.add(leg)
  }

  // Markings / stripes
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(1.01, 1.01, 0.15, 24),
      metalMat(accentColor.getHex())
    )
    stripe.position.y = 4 + i * 3.5
    group.add(stripe)
  }
}

// ── Build interior ─────────────────────────────────────────
function buildInterior(group) {
  const wallMat = metalMat(0x0a1020, 0.8, 0.3)
  const consoleMat = metalMat(0x0d2040, 0.7, 0.5)
  const screenMat = emissiveMat(0x001133, 0x00aaff, 1.0)
  const floorMat = metalMat(0x151c28, 0.9, 0.4)

  // ── Cockpit Deck (y: 18–22) ──
  const cockpitFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 16), floorMat)
  cockpitFloor.position.y = 18.08
  cockpitFloor.userData.isInteriorFloor = true
  group.add(cockpitFloor)

  // Pilot seat
  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), metalMat(0x1a2030))
  seatBase.position.set(0, 18.25, -0.2)
  group.add(seatBase)
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.08), metalMat(0x1a2030))
  seatBack.position.set(0, 18.6, -0.44)
  group.add(seatBack)

  // Cockpit window
  const windowGeo = new THREE.CircleGeometry(0.35, 16)
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x002244, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.6 })
  const windowMesh = new THREE.Mesh(windowGeo, windowMat)
  windowMesh.rotation.x = -Math.PI * 0.15
  windowMesh.position.set(0, 20, 0.85)
  group.add(windowMesh)

  // Flight panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), consoleMat)
  panel.position.set(0, 18.7, 0.55)
  group.add(panel)
  // Screen on panel
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.02), screenMat)
  screen.position.set(0, 18.75, 0.5)
  group.add(screen)

  // Cockpit status lights
  for (let i = 0; i < 5; i++) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 6, 6),
      new THREE.MeshStandardMaterial({ emissive: i % 2 === 0 ? 0x00ff44 : 0xff8800, emissiveIntensity: 1 })
    )
    light.position.set(-0.5 + i * 0.25, 18.92, 0.5)
    group.add(light)
  }

  // ── Crew Cabin Deck (y: 10–16) ──
  const cabinFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 16), floorMat)
  cabinFloor.position.y = 10.08
  cabinFloor.userData.isInteriorFloor = true
  group.add(cabinFloor)

  // Terminal consoles (4 around wall)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.12), consoleMat)
    console_.position.set(Math.sin(angle) * 0.75, 10.6, Math.cos(angle) * 0.75)
    console_.rotation.y = angle
    group.add(console_)
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.02), screenMat)
    scr.position.set(Math.sin(angle) * 0.72, 10.65, Math.cos(angle) * 0.72)
    scr.rotation.y = angle
    group.add(scr)
  }

  // Ladder shaft between decks
  const ladderMat = metalMat(0x334455)
  for (let rung = 0; rung < 10; rung++) {
    const rungMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), ladderMat)
    rungMesh.rotation.z = Math.PI / 2
    rungMesh.position.set(0.8, 10.5 + rung * 0.8, 0)
    group.add(rungMesh)
  }

  // Airlock hatch
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16), metalMat(0x223344))
  hatch.position.set(0, 10.04, 0.65)
  hatch.rotation.x = Math.PI / 2
  group.add(hatch)

  // ── Engineering Deck (y: 3–9) ──
  const engFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 16), floorMat)
  engFloor.position.y = 3.08
  engFloor.userData.isInteriorFloor = true
  group.add(engFloor)

  // Reactor core (glowing sphere)
  const coreGeo = new THREE.SphereGeometry(0.3, 16, 16)
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x002255, emissive: 0x0066ff, emissiveIntensity: 2, transparent: true, opacity: 0.85 })
  const core = new THREE.Mesh(coreGeo, coreMat)
  core.position.y = 5.0
  group.add(core)
  core.userData.isCore = true // animated in game.js tick

  // Core point light
  const coreLight = new THREE.PointLight(0x0066ff, 1.5, 4)
  coreLight.position.y = 5.0
  group.add(coreLight)

  // Power conduits
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const conduit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6),
      emissiveMat(0x001133, 0x003388, 0.5)
    )
    conduit.position.set(Math.sin(angle) * 0.6, 4.75, Math.cos(angle) * 0.6)
    group.add(conduit)
  }

  // Warning lights (flashing red, managed externally)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const warn = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshStandardMaterial({ emissive: 0xff2200, emissiveIntensity: 1 })
    )
    warn.position.set(Math.sin(angle) * 0.85, 7.5, Math.cos(angle) * 0.85)
    warn.userData.isWarning = true
    group.add(warn)
  }

  // Interior wall tubes (structural look)
  for (let y = 2; y < 21; y += 2) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.04, 6, 24), metalMat(0x223344, 0.9, 0.6))
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    group.add(ring)
  }
}

// ── Entry point ────────────────────────────────────────────
export function buildRocket(config = {}) {
  const group = new THREE.Group()
  group.name = 'rocket'

  buildExterior(config, group)
  buildInterior(group)

  // Entrance trigger zone at base
  const triggerGeo = new THREE.BoxGeometry(2, 3, 2)
  const triggerMat = new THREE.MeshBasicMaterial({ visible: false })
  const trigger = new THREE.Mesh(triggerGeo, triggerMat)
  trigger.position.y = 1.5
  trigger.userData.isTrigger = true
  trigger.userData.triggerType = 'rocketEntrance'
  group.add(trigger)

  return group
}

export const DECK_NAMES = ['Engineering', 'Crew Cabin', 'Cockpit']
export function getDeckForY(localY) {
  if (localY < 9)  return 0  // Engineering
  if (localY < 17) return 1  // Crew Cabin
  return 2                   // Cockpit
}
