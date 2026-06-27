// world.js — Scene geometry for each game state

import * as THREE from 'three'
import { physics } from './physics.js'

// ── Shared Materials ───────────────────────────────────────
const concreteMat = () => new THREE.MeshStandardMaterial({ color: 0x6e7a82, roughness: 0.95, metalness: 0.05 })
const metalMat    = (c = 0x445566) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.8 })
const glowMat     = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 1.2, roughness: 0.5 })
const glassMat    = () => new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3 })

// ── Lighting helpers ───────────────────────────────────────
function makeSun(scene, y = 60, color = 0xfff0d0, intensity = 1.6) {
  const sun = new THREE.DirectionalLight(color, intensity)
  sun.position.set(40, y, 30)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 400
  sun.shadow.camera.left = sun.shadow.camera.bottom = -80
  sun.shadow.camera.right = sun.shadow.camera.top = 80
  sun.shadow.bias = -0.001
  scene.add(sun)
  return sun
}

function makePoint(scene, color, intensity, pos, dist) {
  const l = new THREE.PointLight(color, intensity, dist)
  l.position.set(...pos)
  scene.add(l)
  return l
}

// ── Starfield ──────────────────────────────────────────────
function makeStars(scene) {
  const count = 3000
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 800
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    pos[i * 3 + 2] = r * Math.cos(phi)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, sizeAttenuation: true })
  scene.add(new THREE.Points(geo, mat))
}

// ─────────────────────────────────────────────────────────────
//  MAIN MENU SCENE — Futuristic command center
// ─────────────────────────────────────────────────────────────
export function buildMenuScene(scene) {
  scene.background = new THREE.Color(0x020c1b)
  scene.fog = new THREE.FogExp2(0x020c1b, 0.04)

  // Floor — polished dark metal with grid lines
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60, 30, 30),
    new THREE.MeshStandardMaterial({ color: 0x040e1e, roughness: 0.7, metalness: 0.6, wireframe: false })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Grid overlay
  const grid = new THREE.GridHelper(60, 40, 0x003355, 0x001833)
  grid.position.y = 0.01
  scene.add(grid)

  // Back wall
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 20),
    new THREE.MeshStandardMaterial({ color: 0x030d20, roughness: 0.9, metalness: 0.5 })
  )
  wall.position.set(0, 10, -25)
  wall.receiveShadow = true
  scene.add(wall)

  // Large holographic Earth globe (sphere + wireframe)
  const earthSphere = new THREE.Mesh(
    new THREE.SphereGeometry(4, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x002266, emissiveIntensity: 0.4, roughness: 0.8 })
  )
  earthSphere.position.set(8, 4, -12)
  scene.add(earthSphere)

  const earthWire = new THREE.Mesh(
    new THREE.SphereGeometry(4.05, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x0088ff, wireframe: true, transparent: true, opacity: 0.15 })
  )
  earthWire.position.copy(earthSphere.position)
  scene.add(earthWire)
  earthSphere.userData.rotateY = 0.1
  earthWire.userData.rotateY = 0.1

  // Orbiting ring around earth
  const orbitRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.5, 0.03, 6, 64),
    glowMat(0x0044aa, 0x0088ff)
  )
  orbitRing.position.copy(earthSphere.position)
  orbitRing.rotation.x = 0.5
  scene.add(orbitRing)
  orbitRing.userData.rotateZ = 0.3

  // Small orbit satellite
  const sat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.5), metalMat(0x889aaa))
  sat.position.copy(earthSphere.position)
  sat.userData.orbitEarth = { radius: 5.5, speed: 0.8, angle: 0 }
  scene.add(sat)

  // Monitor screens on wall
  const screenPositions = [-12, -6, 0, 6, 12]
  screenPositions.forEach((x, i) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3, 0.15), metalMat(0x111a28))
    frame.position.set(x, 9, -24.9)
    scene.add(frame)
    const scrContent = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.7),
      new THREE.MeshStandardMaterial({
        color: 0x001122,
        emissive: [0x003388, 0x004400, 0x330033, 0x003333, 0x220044][i],
        emissiveIntensity: 0.7,
      })
    )
    scrContent.position.set(x, 9, -24.78)
    scene.add(scrContent)
  })

  // Neon light strips along ceiling
  for (let x = -20; x <= 20; x += 8) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 50), glowMat(0x002244, 0x0055aa))
    strip.position.set(x, 8, 0)
    scene.add(strip)
    const l = new THREE.PointLight(0x0077cc, 0.5, 20)
    l.position.set(x, 7.5, 0)
    scene.add(l)
  }

  // Control desk pillars
  for (let x of [-10, 0, 10]) {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1.5), metalMat(0x0a1828))
    desk.position.set(x, 0.5, 3)
    desk.castShadow = true
    desk.receiveShadow = true
    scene.add(desk)
    const deskScreen = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.8, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x001122, emissive: 0x0066bb, emissiveIntensity: 0.8 })
    )
    deskScreen.position.set(x, 1.2, 2.4)
    deskScreen.rotation.x = -0.4
    scene.add(deskScreen)
  }

  // Ambient + key light
  const ambient = new THREE.AmbientLight(0x0a1628, 1.0)
  scene.add(ambient)
  makePoint(scene, 0x0066ff, 0.8, [8, 8, -10], 30)
  makePoint(scene, 0xffaa00, 0.4, [-8, 5, 0], 20)

  makeStars(scene)

  return { earthSphere, earthWire, orbitRing, sat }
}

// ─────────────────────────────────────────────────────────────
//  HANGAR SCENE
// ─────────────────────────────────────────────────────────────
export function buildHangarScene(scene) {
  scene.background = new THREE.Color(0x030810)
  scene.fog = new THREE.FogExp2(0x030810, 0.025)

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x060f1a, roughness: 0.8, metalness: 0.5 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  // Pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.8, 0.4, 32),
    new THREE.MeshStandardMaterial({ color: 0x0a1828, roughness: 0.3, metalness: 0.9 })
  )
  pedestal.receiveShadow = true
  pedestal.castShadow = true
  scene.add(pedestal)

  // Pedestal ring glow
  const pedRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.05, 6, 64),
    glowMat(0x003355, 0x00aaff)
  )
  pedRing.rotation.x = Math.PI / 2
  pedRing.position.y = 0.22
  scene.add(pedRing)

  // Overhead floodlights
  for (let a = 0; a < 4; a++) {
    const angle = (a / 4) * Math.PI * 2
    const flood = new THREE.SpotLight(0xfff0e0, 2.0, 30, Math.PI / 6, 0.3)
    flood.position.set(Math.sin(angle) * 8, 12, Math.cos(angle) * 8)
    flood.target.position.set(0, 0, 0)
    flood.castShadow = true
    scene.add(flood)
    scene.add(flood.target)
  }

  // Side walls with status screens
  for (const [x, rx] of [[-18, 0], [18, Math.PI]]) {
    const wallPanel = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({ color: 0x040c18 }))
    wallPanel.position.set(x, 6, 0)
    wallPanel.rotation.y = rx
    scene.add(wallPanel)
    for (let i = 0; i < 3; i++) {
      const scr = new THREE.Mesh(
        new THREE.BoxGeometry(5, 3.5, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x001122, emissive: [0x002288, 0x008822, 0x882200][i], emissiveIntensity: 0.7 })
      )
      scr.position.set(x + (rx ? -0.1 : 0.1), 7, -6 + i * 6)
      scr.rotation.y = rx
      scene.add(scr)
    }
  }

  scene.add(new THREE.AmbientLight(0x0a1628, 0.6))
  makeStars(scene)
}

// ─────────────────────────────────────────────────────────────
//  TEST FACILITY SCENE — Full launch complex
// ─────────────────────────────────────────────────────────────
export function buildFacilityScene(scene) {
  scene.background = new THREE.Color(0x04111e)
  scene.fog = new THREE.FogExp2(0x04111e, 0.012)

  const objs = { collidables: [] }

  // ── Ground plane ──
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 80, 80),
    new THREE.MeshStandardMaterial({ color: 0x2a3520, roughness: 1.0, metalness: 0.0 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  objs.ground = ground

  // ── Concrete launchpad ──
  const launchpad = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 18, 0.6, 32),
    concreteMat()
  )
  launchpad.receiveShadow = true
  launchpad.castShadow = true
  scene.add(launchpad)
  objs.collidables.push(launchpad)

  // Blast trench
  const trench = new THREE.Mesh(
    new THREE.BoxGeometry(5, 2, 25),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 })
  )
  trench.position.set(0, -1.2, 10)
  scene.add(trench)

  // Launchpad surface marks
  const markMat = new THREE.MeshBasicMaterial({ color: 0x666655 })
  for (let r of [4, 8, 12]) {
    const circle = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 4, 64), markMat)
    circle.rotation.x = -Math.PI / 2
    circle.position.y = 0.35
    scene.add(circle)
  }

  // ── Launch Tower ──
  const towerX = -12
  // Main columns (4)
  for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 2; iz++) {
    const col = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 50, 0.8),
      metalMat(0x445566)
    )
    col.position.set(towerX - 2 + ix * 4, 25, -2 + iz * 4)
    col.castShadow = true
    scene.add(col)
    objs.collidables.push(col)
  }

  // Tower floors / platforms
  for (let y = 0; y <= 50; y += 6) {
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(5, 0.2, 5),
      metalMat(0x334455)
    )
    platform.position.set(towerX, y, 0)
    platform.castShadow = true
    platform.receiveShadow = true
    scene.add(platform)
    objs.collidables.push(platform)
  }

  // Swing arm at top
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.3, 1.0),
    metalMat(0x556677)
  )
  arm.position.set(towerX + 4, 48, 0)
  scene.add(arm)

  // Tower ladder
  for (let rung = 0; rung < 25; rung++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 4), metalMat(0x556677))
    r.rotation.z = Math.PI / 2
    r.position.set(towerX - 3.1, 1 + rung * 2, 0)
    scene.add(r)
  }

  // Tower lights (warning strobes)
  for (let y = 10; y <= 50; y += 10) {
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshStandardMaterial({ emissive: 0xff2200, emissiveIntensity: 1 }))
    strobe.position.set(towerX - 2.5, y, 0)
    scene.add(strobe)
  }

  // ── Mission Control Building ──
  const mcBase = new THREE.Mesh(
    new THREE.BoxGeometry(24, 8, 16),
    concreteMat()
  )
  mcBase.position.set(-50, 4, -15)
  mcBase.castShadow = true
  mcBase.receiveShadow = true
  scene.add(mcBase)
  objs.collidables.push(mcBase)

  // MC Windows
  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.1), glassMat())
    win.position.set(-50 - 10 + i * 3, 5, -7)
    scene.add(win)
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 0.05), new THREE.MeshStandardMaterial({ emissive: 0xffaa44, emissiveIntensity: 0.6 }))
    glow.position.set(-50 - 10 + i * 3, 5, -7.1)
    scene.add(glow)
  }

  // MC sign light
  makePoint(scene, 0xffaa44, 1.0, [-50, 9, -7], 20)

  // MC roof antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), metalMat())
  antenna.position.set(-50, 11, -15)
  scene.add(antenna)
  const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), glowMat(0x440000, 0xff0000))
  antennaBall.position.set(-50, 14.1, -15)
  scene.add(antennaBall)

  // ── Fuel tanks / support structures ──
  for (const [x, z, r, h] of [[10, -20, 3, 12], [20, -10, 2, 8], [15, -30, 2.5, 10]]) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 16),
      new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.4, metalness: 0.7 })
    )
    tank.position.set(x, h / 2, z)
    tank.castShadow = true
    scene.add(tank)
    objs.collidables.push(tank)
  }

  // ── Perimeter fence ──
  for (let a = 0; a < 40; a++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 0.15), metalMat(0x556677))
    const angle = (a / 40) * Math.PI * 2
    post.position.set(Math.sin(angle) * 90, 1.25, Math.cos(angle) * 90)
    scene.add(post)
  }

  // ── Road to complex ──
  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 120), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }))
  road.rotation.x = -Math.PI / 2
  road.position.set(30, 0.01, 10)
  road.rotation.z = Math.PI * 0.15
  scene.add(road)

  // ── Lighting ──
  makeSun(scene)
  const moonLight = new THREE.DirectionalLight(0x3355aa, 0.3)
  moonLight.position.set(-60, 40, -40)
  scene.add(moonLight)

  scene.add(new THREE.AmbientLight(0x051020, 0.8))

  // Floodlights around pad
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const fl = new THREE.SpotLight(0xffeedd, 1.2, 80, Math.PI / 7, 0.4)
    fl.position.set(Math.sin(angle) * 24, 18, Math.cos(angle) * 24)
    fl.target.position.set(0, 0, 0)
    fl.castShadow = true
    scene.add(fl); scene.add(fl.target)
  }

  makeStars(scene)
  return objs
}
