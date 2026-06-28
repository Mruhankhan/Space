// rocket.js — procedural rocket geometry with walkable interior.
// Exterior + 3 interior decks (engineering, crew cabin, cockpit).
// Uses shared geometries/materials to keep draw-call count low.

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three'

// ── Shared geometry/material cache (built lazily) ──────────
let _geo = null
let _mat = null

function G() {
  if (_geo) return _geo
  _geo = {
    coneSmall: new ConeGeometry(1.0, 4, 16),
    cylWide:   new CylinderGeometry(1.0, 1.0, 6, 16),
    cylTall:   new CylinderGeometry(1.0, 1.0, 12, 16),
    cylRing:   new CylinderGeometry(1.05, 1.05, 0.4, 16),
    cylStage2: new CylinderGeometry(0.85, 0.85, 8, 16),
    cylStage3: new CylinderGeometry(0.65, 0.65, 5, 14),
    cylStage3Ring: new CylinderGeometry(0.75, 0.75, 0.3, 14),
    engineMount: new CylinderGeometry(1.0, 1.2, 1.5, 16),
    bellCone: new ConeGeometry(0.22, 0.8, 8),
    finBox:   new BoxGeometry(0.08, 1.2, 1.2),
    legBox:   new BoxGeometry(0.08, 2.5, 0.08),
    stripeCyl: new CylinderGeometry(1.01, 1.01, 0.15, 16),

    // Interior
    floorCyl:  new CylinderGeometry(0.9, 0.9, 0.15, 12),
    seatBase:  new BoxGeometry(0.5, 0.15, 0.5),
    seatBack:  new BoxGeometry(0.5, 0.7, 0.08),
    windowCircle: new CircleGeometry(0.35, 16),
    panel:     new BoxGeometry(1.4, 0.5, 0.1),
    panelScreen: new BoxGeometry(1.0, 0.3, 0.02),
    console:   new BoxGeometry(0.6, 0.8, 0.12),
    consoleScr: new BoxGeometry(0.45, 0.55, 0.02),
    consoleBig: new BoxGeometry(1.2, 0.5, 0.12),
    ladderRung: new CylinderGeometry(0.04, 0.04, 0.5, 4),
    hatch:     new CylinderGeometry(0.35, 0.35, 0.08, 12),
    coreSphere: new SphereGeometry(0.3, 12, 12),
    conduit:   new CylinderGeometry(0.04, 0.04, 3.5, 4),
    warnSphere: new SphereGeometry(0.06, 6, 6),
    ringTorus: new TorusGeometry(0.88, 0.04, 4, 16),
    dotSphere:  new SphereGeometry(0.04, 6, 6),
  }
  return _geo
}

function M() {
  if (_mat) return _mat
  _mat = {
    body:    new MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.85 }),
    accent:  new MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.35, metalness: 0.85 }),
    darkMetal: new MeshStandardMaterial({ color: 0x444455, roughness: 0.4, metalness: 0.85 }),
    bell:    new MeshStandardMaterial({ color: 0x333344, roughness: 0.4, metalness: 0.85 }),
    fin:     new MeshStandardMaterial({ color: 0x666677, roughness: 0.5, metalness: 0.7 }),
    leg:     new MeshStandardMaterial({ color: 0x555566, roughness: 0.5, metalness: 0.7 }),
    wall:    new MeshStandardMaterial({ color: 0x0a1020, roughness: 0.8, metalness: 0.3 }),
    console: new MeshStandardMaterial({ color: 0x0d2040, roughness: 0.7, metalness: 0.5 }),
    screen:  new MeshStandardMaterial({ color: 0x001133, emissive: 0x00aaff, emissiveIntensity: 1.0, roughness: 0.6, metalness: 0.3 }),
    floor:   new MeshStandardMaterial({ color: 0x151c28, roughness: 0.9, metalness: 0.4 }),
    seat:    new MeshStandardMaterial({ color: 0x1a2030, roughness: 0.7, metalness: 0.4 }),
    window:  new MeshStandardMaterial({ color: 0x002244, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.6 }),
    ladder:  new MeshStandardMaterial({ color: 0x334455, roughness: 0.5, metalness: 0.6 }),
    hatch:   new MeshStandardMaterial({ color: 0x223344, roughness: 0.5, metalness: 0.6 }),
    core:    new MeshStandardMaterial({ color: 0x002255, emissive: 0x0066ff, emissiveIntensity: 2, transparent: true, opacity: 0.85 }),
    conduit: new MeshStandardMaterial({ color: 0x001133, emissive: 0x003388, emissiveIntensity: 0.5, roughness: 0.6, metalness: 0.3 }),
    warn:    new MeshStandardMaterial({ emissive: 0xff2200, emissiveIntensity: 1 }),
    ring:    new MeshStandardMaterial({ color: 0x223344, roughness: 0.9, metalness: 0.6 }),
    dotGreen: new MeshStandardMaterial({ emissive: 0x00ff44, emissiveIntensity: 1 }),
    dotAmber: new MeshStandardMaterial({ emissive: 0xff8800, emissiveIntensity: 1 }),
  }
  return _mat
}

// ── Mark shell — used as collision tag ────────────────────
function markShell(mesh) {
  mesh.userData.isRocketShell = true
  mesh.userData.ignoreWhenInside = true
  mesh.userData.sharedGeometry = true
  return mesh
}

// ── Exterior ───────────────────────────────────────────────
function buildExterior(config, group) {
  const m = M()
  const g = G()
  const bodyColor   = new Color(config.color || '#e8e8e8').getHex()
  const accentColor = new Color(config.accentColor || '#1a1a2e').getHex()

  // Override body/accent materials per rocket config (cheap clone).
  const bodyMat   = new MeshStandardMaterial({ color: bodyColor,   roughness: 0.35, metalness: 0.85 })
  const accentMat = new MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.85 })

  const hasStage2 = config.stages >= 2
  const hasStage3 = config.stages >= 3

  const noseCone = new Mesh(g.coneSmall, bodyMat)
  noseCone.position.y = 22
  noseCone.castShadow = true
  group.add(markShell(noseCone))

  const fairing = new Mesh(g.cylWide, bodyMat)
  fairing.position.y = 17
  fairing.castShadow = true
  group.add(markShell(fairing))

  const tank1 = new Mesh(g.cylTall, bodyMat)
  tank1.position.y = 8
  tank1.castShadow = true
  tank1.receiveShadow = true
  group.add(markShell(tank1))

  const ring = new Mesh(g.cylRing, accentMat)
  ring.position.y = 14
  group.add(markShell(ring))

  if (hasStage2) {
    const tank2 = new Mesh(g.cylStage2, bodyMat)
    tank2.position.y = 18.5
    tank2.castShadow = true
    group.add(markShell(tank2))
  }

  if (hasStage3) {
    const stage3 = new Mesh(g.cylStage3, bodyMat)
    stage3.position.y = 24.5
    stage3.castShadow = true
    group.add(markShell(stage3))

    const stageRing = new Mesh(g.cylStage3Ring, accentMat)
    stageRing.position.y = 21.75
    group.add(markShell(stageRing))
  }

  const engineMount = new Mesh(g.engineMount, m.darkMetal)
  engineMount.position.y = 1.5
  group.add(markShell(engineMount))

  // Engine bells (instanced).
  const bellCount = config.template === 'falcon9' ? 9 : config.template === 'saturnv' ? 5 : 3
  const bellRadius = config.template === 'falcon9' ? 0.7 : 0.5
  if (bellCount > 0) {
    const bellInst = new InstancedMesh(g.bellCone, m.bell, bellCount)
    const dummy = new Object3D()
    for (let i = 0; i < bellCount; i++) {
      const angle = (i / bellCount) * Math.PI * 2
      dummy.position.set(Math.sin(angle) * bellRadius, 0.2, Math.cos(angle) * bellRadius)
      dummy.rotation.set(Math.PI, 0, 0)
      dummy.updateMatrix()
      bellInst.setMatrixAt(i, dummy.matrix)
      bellInst.userData.isRocketShell = true
      bellInst.userData.ignoreWhenInside = true
    }
    group.add(bellInst)
  }

  // Falcon9 grid fins.
  if (config.template === 'falcon9') {
    const finInst = new InstancedMesh(g.finBox, m.fin, 4)
    const dummy = new Object3D()
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      dummy.position.set(Math.sin(angle) * 1.1, 12, Math.cos(angle) * 1.1)
      dummy.rotation.set(0, angle, 0)
      dummy.updateMatrix()
      finInst.setMatrixAt(i, dummy.matrix)
      finInst.userData.isRocketShell = true
      finInst.userData.ignoreWhenInside = true
    }
    group.add(finInst)
  }

  // Landing legs (instanced).
  const legInst = new InstancedMesh(g.legBox, m.leg, 4)
  const dummy = new Object3D()
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    dummy.position.set(Math.sin(angle) * 1.4, 1.25, Math.cos(angle) * 1.4)
    dummy.rotation.set(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35)
    dummy.updateMatrix()
    legInst.setMatrixAt(i, dummy.matrix)
    legInst.userData.isRocketShell = true
    legInst.userData.ignoreWhenInside = true
  }
  group.add(legInst)

  // Stripe rings (instanced).
  const stripeInst = new InstancedMesh(g.stripeCyl, accentMat, 3)
  for (let i = 0; i < 3; i++) {
    const d = new Object3D()
    d.position.set(0, 4 + i * 3.5, 0)
    d.updateMatrix()
    stripeInst.setMatrixAt(i, d.matrix)
  }
  stripeInst.userData.isRocketShell = true
  stripeInst.userData.ignoreWhenInside = true
  group.add(stripeInst)
}

// ── Interior ───────────────────────────────────────────────
function buildInterior(group) {
  const g = G()
  const m = M()

  // Cockpit floor (deck 2).
  const cockpitFloor = new Mesh(g.floorCyl, m.floor)
  cockpitFloor.position.y = 18.08
  cockpitFloor.userData.isInteriorFloor = true
  group.add(cockpitFloor)

  // Pilot seat.
  const seatBase = new Mesh(g.seatBase, m.seat)
  seatBase.position.set(0, 18.25, -0.2)
  group.add(seatBase)
  const seatBack = new Mesh(g.seatBack, m.seat)
  seatBack.position.set(0, 18.6, -0.44)
  group.add(seatBack)

  // Cockpit window.
  const windowMesh = new Mesh(g.windowCircle, m.window)
  windowMesh.rotation.x = -Math.PI * 0.15
  windowMesh.position.set(0, 20, 0.85)
  group.add(windowMesh)

  // Panel + screen.
  const panel = new Mesh(g.panel, m.console)
  panel.position.set(0, 18.7, 0.55)
  group.add(panel)
  const scr = new Mesh(g.panelScreen, m.screen)
  scr.position.set(0, 18.75, 0.5)
  group.add(scr)

  // Cockpit status dots (instanced, alternating green/amber).
  for (let i = 0; i < 5; i++) {
    const dot = new Mesh(g.dotSphere, i % 2 === 0 ? m.dotGreen : m.dotAmber)
    dot.position.set(-0.5 + i * 0.25, 18.92, 0.5)
    group.add(dot)
  }

  // Crew cabin floor (deck 1).
  const cabinFloor = new Mesh(g.floorCyl, m.floor)
  cabinFloor.position.y = 10.08
  cabinFloor.userData.isInteriorFloor = true
  group.add(cabinFloor)

  // 4 cabin consoles (instanced per part).
  const consoleInst = new InstancedMesh(g.console, m.console, 4)
  const scrInst = new InstancedMesh(g.consoleScr, m.screen, 4)
  const cDummy = new Object3D()
  const sDummy = new Object3D()
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const x = Math.sin(angle) * 0.75
    const z = Math.cos(angle) * 0.75
    cDummy.position.set(x, 10.6, z)
    cDummy.rotation.set(0, angle, 0)
    cDummy.updateMatrix()
    consoleInst.setMatrixAt(i, cDummy.matrix)
    sDummy.position.set(Math.sin(angle) * 0.72, 10.65, Math.cos(angle) * 0.72)
    sDummy.rotation.set(0, angle, 0)
    sDummy.updateMatrix()
    scrInst.setMatrixAt(i, sDummy.matrix)
  }
  consoleInst.userData.consoleTag = true
  group.add(consoleInst)
  group.add(scrInst)

  // Each instance needs its own consoleId for activation logic — add a separate non-instanced lookup wrapper.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const wrapper = new Mesh(g.console, m.console)
    wrapper.visible = false
    wrapper.position.set(Math.sin(angle) * 0.75, 10.6, Math.cos(angle) * 0.75)
    wrapper.rotation.y = angle
    wrapper.userData.isConsole = true
    wrapper.userData.consoleId = `cabin-console-${i + 1}`
    group.add(wrapper)
  }

  // Cockpit launch console (interactive).
  const flightConsole = new Mesh(g.consoleBig, m.console)
  flightConsole.position.set(0, 18.7, 0.9)
  flightConsole.rotation.y = Math.PI
  flightConsole.userData.isConsole = true
  flightConsole.userData.consoleId = 'cockpit-launch-console'
  group.add(flightConsole)

  // Ladder rungs (instanced).
  const rungCount = 10
  const rungInst = new InstancedMesh(g.ladderRung, m.ladder, rungCount)
  const dummy = new Object3D()
  for (let i = 0; i < rungCount; i++) {
    dummy.position.set(0.8, 10.5 + i * 0.8, 0)
    dummy.rotation.set(0, 0, Math.PI / 2)
    dummy.updateMatrix()
    rungInst.setMatrixAt(i, dummy.matrix)
  }
  group.add(rungInst)

  // Hatch.
  const hatch = new Mesh(g.hatch, m.hatch)
  hatch.position.set(0, 10.04, 0.65)
  hatch.rotation.x = Math.PI / 2
  group.add(hatch)

  // Engineering floor (deck 0).
  const engFloor = new Mesh(g.floorCyl, m.floor)
  engFloor.position.y = 3.08
  engFloor.userData.isInteriorFloor = true
  group.add(engFloor)

  // Reactor core (animated).
  const core = new Mesh(g.coreSphere, m.core)
  core.position.y = 5.0
  core.userData.isCore = true
  group.add(core)

  const coreLight = new PointLight(0x0066ff, 1.5, 4)
  coreLight.position.y = 5.0
  group.add(coreLight)

  // Power conduits (instanced).
  const conduitInst = new InstancedMesh(g.conduit, m.conduit, 6)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    dummy.position.set(Math.sin(angle) * 0.6, 4.75, Math.cos(angle) * 0.6)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    conduitInst.setMatrixAt(i, dummy.matrix)
  }
  group.add(conduitInst)

  // Warning lights (instanced).
  const warnInst = new InstancedMesh(g.warnSphere, m.warn, 4)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    dummy.position.set(Math.sin(angle) * 0.85, 7.5, Math.cos(angle) * 0.85)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    warnInst.setMatrixAt(i, dummy.matrix)
    warnInst.userData.isWarning = true
  }
  group.add(warnInst)

  // Interior ring bands (instanced).
  const bandCount = 10
  const bands = new InstancedMesh(g.ringTorus, m.ring, bandCount)
  for (let i = 0; i < bandCount; i++) {
    dummy.position.set(0, 2 + i * 2, 0)
    dummy.rotation.set(Math.PI / 2, 0, 0)
    dummy.updateMatrix()
    bands.setMatrixAt(i, dummy.matrix)
  }
  group.add(bands)
}

// ── Entry point ────────────────────────────────────────────
export function buildRocket(config = {}) {
  const group = new Group()
  group.name = config.name || 'Rocket'
  group.userData.config = config
  group.userData.sharedGeometry = true

  buildExterior(config, group)
  buildInterior(group)

  // Mark every descendant whose geometry/material is shared so that
  // renderer.disposeObject can skip them — otherwise the module-level
  // G() / M() singletons would be freed after the first rocket disposal
  // and every subsequent build would render as invisible.
  group.traverse(obj => {
    if (obj !== group && obj.userData && !obj.userData.sharedGeometry) {
      obj.userData.sharedGeometry = true
    }
  })

  return group
}

export const DECK_NAMES = ['Engineering', 'Crew Cabin', 'Cockpit']
export function getDeckForY(localY) {
  if (localY < 9)  return 0  // Engineering
  if (localY < 17) return 1  // Crew Cabin
  return 2                   // Cockpit
}