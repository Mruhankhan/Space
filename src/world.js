// world.js — Procedural scene geometry + collision data.
// Returns:
//   { floors: Mesh[], boxes: Mesh[], earthSphere, earthWire, orbitRing, sat }

import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  GridHelper,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ── Shared materials ──
const MAT = {
  concrete: new MeshStandardMaterial({ color: 0x87919a, roughness: 0.9, metalness: 0.04 }),
  metalDark: new MeshStandardMaterial({ color: 0x445566, roughness: 0.4, metalness: 0.8 }),
  metalMid:  new MeshStandardMaterial({ color: 0x586b78, roughness: 0.5, metalness: 0.7 }),
  metalLight: new MeshStandardMaterial({ color: 0x7890a0, roughness: 0.4, metalness: 0.85 }),
  metalRung:  new MeshStandardMaterial({ color: 0x556677, roughness: 0.6, metalness: 0.6 }),
  glass:     new MeshStandardMaterial({ color: 0x88aacc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3 }),
  ground:    new MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.95, metalness: 0.0 }),
  grass:     new MeshStandardMaterial({ color: 0x1a2e16, roughness: 1.0, metalness: 0.0 }),
  stripGlow: new MeshStandardMaterial({ color: 0x002244, emissive: 0x0055aa, emissiveIntensity: 1.2, roughness: 0.5 }),
  panel:     new MeshStandardMaterial({ color: 0x040c18, roughness: 0.85 }),
  wall:      new MeshStandardMaterial({ color: 0x030d20, roughness: 0.9, metalness: 0.5 }),
  floorMenu: new MeshStandardMaterial({ color: 0x040e1e, roughness: 0.7, metalness: 0.6 }),
  floorHangar: new MeshStandardMaterial({ color: 0x101a24, roughness: 0.72, metalness: 0.42 }),
  pedestal:  new MeshStandardMaterial({ color: 0x0a1828, roughness: 0.3, metalness: 0.9 }),
  road:      new MeshStandardMaterial({ color: 0x20242a, roughness: 0.95 }),
  tankBody:  new MeshStandardMaterial({ color: 0xd6e1e8, roughness: 0.35, metalness: 0.72 }),
  antenna:   new MeshStandardMaterial({ color: 0x889aaa, roughness: 0.4, metalness: 0.7 }),
  earthBody: new MeshStandardMaterial({ color: 0x001133, emissive: 0x002266, emissiveIntensity: 0.4, roughness: 0.8 }),
  earthWire: new MeshBasicMaterial({ color: 0x0088ff, wireframe: true, transparent: true, opacity: 0.15 }),
  ring:      new MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0088ff, emissiveIntensity: 1.2, roughness: 0.5 }),
  ringAmber: new MeshStandardMaterial({ color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 1.2, roughness: 0.5 }),
  starPoint: new PointsMaterial({ color: 0xffffff, size: 0.75, sizeAttenuation: true }),
  postFence: new MeshStandardMaterial({ color: 0x556677, roughness: 0.6, metalness: 0.5 }),
  strobe:    new MeshStandardMaterial({ emissive: 0xff2200, emissiveIntensity: 1 }),
  platform:  new MeshStandardMaterial({ color: 0x586b78, emissive: 0x1a3a5c, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.7 }),
  trench:    new MeshStandardMaterial({ color: 0x152030, roughness: 0.9 }),
  mark:      new MeshBasicMaterial({ color: 0x666655 }),
  windowGlow: new MeshStandardMaterial({ emissive: 0xffaa44, emissiveIntensity: 0.6 }),
  sign:      new MeshStandardMaterial({ color: 0x112238, emissive: 0x0aa7ff, emissiveIntensity: 0.55 }),
  antennaBall: new MeshStandardMaterial({ color: 0x440000, emissive: 0xff0000, emissiveIntensity: 1 }),
}

let _starGeo = null
function getStars() {
  if (_starGeo) return _starGeo
  const count = 1400
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 800
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    pos[i * 3 + 2] = r * Math.cos(phi)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  _starGeo = geo
  return geo
}

function addStars(scene) {
  const stars = new Points(getStars(), MAT.starPoint)
  stars.userData.persistent = true
  scene.add(stars)
  return stars
}

// ── Merge helper for decorative meshes ──
function mergeByMaterial(meshes) {
  const groups = new Map()
  for (const m of meshes) {
    const key = m.material.uuid
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(m)
  }
  const result = []
  for (const group of groups.values()) {
    if (group.length < 2) {
      result.push(...group)
      continue
    }
    const geoms = group.map(m => {
      m.updateMatrixWorld()
      const g = m.geometry.clone()
      g.applyMatrix4(m.matrixWorld)
      return g
    })
    const merged = mergeGeometries(geoms)
    const mesh = new Mesh(merged, group[0].material)
    mesh.userData.persistent = true
    result.push(mesh)
  }
  return result
}

const BEAM_X_AXIS = new Vector3(1, 0, 0)
function beamBetween(start, end, thickness, material) {
  const dir = end.clone().sub(start)
  const mesh = new Mesh(new BoxGeometry(dir.length(), thickness, thickness), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(BEAM_X_AXIS, dir.normalize())
  mesh.userData.persistent = true
  return mesh
}

// ─────────────────────────────────────────────────────────────
//  MAIN MENU SCENE
// ─────────────────────────────────────────────────────────────
export function buildMenuScene(scene) {
  scene.background = new Color(0x020c1b)
  scene.fog = new FogExp2(0x020c1b, 0.04)

  const floor = new Mesh(new PlaneGeometry(60, 60), MAT.floorMenu)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.userData.persistent = true
  scene.add(floor)

  const grid = new GridHelper(60, 40, 0x003355, 0x001833)
  grid.position.y = 0.01
  grid.userData.persistent = true
  scene.add(grid)

  const wall = new Mesh(new PlaneGeometry(60, 20), MAT.wall)
  wall.position.set(0, 10, -25)
  wall.receiveShadow = true
  wall.userData.persistent = true
  scene.add(wall)

  const earthSphere = new Mesh(new SphereGeometry(4, 32, 32), MAT.earthBody)
  earthSphere.position.set(8, 4, -12)
  earthSphere.userData.persistent = true
  scene.add(earthSphere)

  const earthWire = new Mesh(new SphereGeometry(4.05, 16, 16), MAT.earthWire)
  earthWire.position.copy(earthSphere.position)
  earthWire.userData.persistent = true
  scene.add(earthWire)

  const orbitRing = new Mesh(new TorusGeometry(5.5, 0.03, 6, 64), MAT.ring)
  orbitRing.position.copy(earthSphere.position)
  orbitRing.rotation.x = 0.5
  orbitRing.userData.persistent = true
  scene.add(orbitRing)

  const sat = new Mesh(new BoxGeometry(0.3, 0.1, 0.5), MAT.antenna)
  sat.position.copy(earthSphere.position)
  sat.userData.orbitEarth = { radius: 5.5, angle: 0 }
  sat.userData.persistent = true
  scene.add(sat)

  const screenPositions = [-12, -6, 0, 6, 12]
  const screenColors = [0x003388, 0x004400, 0x330033, 0x003333, 0x220044]
  for (let i = 0; i < screenPositions.length; i++) {
    const frame = new Mesh(new BoxGeometry(4.5, 3, 0.15), MAT.metalDark)
    frame.position.set(screenPositions[i], 9, -24.9)
    frame.userData.persistent = true
    scene.add(frame)
    const scr = new Mesh(
      new PlaneGeometry(4.2, 2.7),
      new MeshStandardMaterial({
        color: 0x001122,
        emissive: screenColors[i],
        emissiveIntensity: 0.7,
      })
    )
    scr.position.set(screenPositions[i], 9, -24.78)
    scr.userData.persistent = true
    scene.add(scr)
  }

  for (let x = -20; x <= 20; x += 8) {
    const strip = new Mesh(new BoxGeometry(0.1, 0.1, 50), MAT.stripGlow)
    strip.position.set(x, 8, 0)
    strip.userData.persistent = true
    scene.add(strip)
  }

  for (const x of [-10, 0, 10]) {
    const desk = new Mesh(new BoxGeometry(4, 1, 1.5), MAT.metalDark)
    desk.position.set(x, 0.5, 3)
    desk.receiveShadow = true
    desk.userData.persistent = true
    scene.add(desk)
    const scr = new Mesh(
      new BoxGeometry(3.5, 0.8, 0.05),
      new MeshStandardMaterial({ color: 0x001122, emissive: 0x0066bb, emissiveIntensity: 0.8 })
    )
    scr.position.set(x, 1.2, 2.4)
    scr.rotation.x = -0.4
    scr.userData.persistent = true
    scene.add(scr)
  }

  addStars(scene)

  return { earthSphere, earthWire, orbitRing, sat }
}

// ─────────────────────────────────────────────────────────────
//  HANGAR SCENE
// ─────────────────────────────────────────────────────────────
export function buildHangarScene(scene) {
  scene.background = new Color(0x06111d)
  scene.fog = new FogExp2(0x06111d, 0.012)

  const floor = new Mesh(new PlaneGeometry(50, 50), MAT.floorHangar)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.userData.persistent = true
  scene.add(floor)

  const pedestal = new Mesh(
    new CylinderGeometry(2.5, 2.8, 0.4, 32),
    MAT.pedestal
  )
  pedestal.receiveShadow = true
  pedestal.userData.persistent = true
  scene.add(pedestal)

  const pedRing = new Mesh(
    new TorusGeometry(2.6, 0.05, 6, 64),
    MAT.ringAmber
  )
  pedRing.rotation.x = Math.PI / 2
  pedRing.position.y = 0.22
  pedRing.userData.persistent = true
  scene.add(pedRing)

  for (const [x, rx] of [[-18, 0], [18, Math.PI]]) {
    const wall = new Mesh(new PlaneGeometry(30, 12), MAT.panel)
    wall.position.set(x, 6, 0)
    wall.rotation.y = rx
    wall.userData.persistent = true
    scene.add(wall)
    const colors = [0x002288, 0x008822, 0x882200]
    for (let i = 0; i < 3; i++) {
      const scr = new Mesh(
        new BoxGeometry(5, 3.5, 0.1),
        new MeshStandardMaterial({ color: 0x001122, emissive: colors[i], emissiveIntensity: 0.7 })
      )
      scr.position.set(x + (rx ? -0.1 : 0.1), 7, -6 + i * 6)
      scr.rotation.y = rx
      scr.userData.persistent = true
      scene.add(scr)
    }
  }

  addStars(scene)
}

// ─────────────────────────────────────────────────────────────
//  FACILITY SCENE
// ─────────────────────────────────────────────────────────────
export function buildFacilityScene(scene) {
  scene.background = new Color(0x061728)
  scene.fog = new FogExp2(0x061728, 0.003)

  const objs = { floors: [], boxes: [] }
  const toMerge = []

  // ── Ground ──
  const ground = new Mesh(new PlaneGeometry(400, 400), MAT.ground)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.userData.persistent = true
  scene.add(ground)
  objs.ground = ground

  // Grass
  const grass = new Mesh(new PlaneGeometry(1600, 1600), MAT.grass)
  grass.rotation.x = -Math.PI / 2
  grass.position.y = -0.01
  grass.receiveShadow = true
  grass.userData.persistent = true
  scene.add(grass)

  // ── Launchpad ──
  const launchpad = new Mesh(new CylinderGeometry(18, 18, 0.6, 32), MAT.concrete)
  launchpad.receiveShadow = true
  launchpad.castShadow = true
  launchpad.userData.persistent = true
  scene.add(launchpad)
  objs.floors.push(launchpad)

  // Flame trench
  const trench = new Mesh(new BoxGeometry(4, 2, 20), MAT.trench)
  trench.position.set(0, -1, 0)
  trench.userData.persistent = true
  scene.add(trench)

  // Surface marks
  for (const r of [4, 8, 12]) {
    const circle = new Mesh(new TorusGeometry(r, 0.1, 4, 64), MAT.mark)
    circle.rotation.x = -Math.PI / 2
    circle.position.y = 0.35
    toMerge.push(circle)
  }

  // ── Launch tower ──
  const towerX = -12
  for (let ix = 0; ix < 2; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      const col = new Mesh(new BoxGeometry(0.8, 50, 0.8), MAT.metalDark)
      col.position.set(towerX - 2 + ix * 4, 25, -2 + iz * 4)
      col.userData.persistent = true
      scene.add(col)
      objs.boxes.push(col)
    }
  }

  // Tower platforms
  for (let y = 0; y <= 50; y += 6) {
    const platform = new Mesh(new BoxGeometry(7, 0.35, 7), MAT.platform)
    platform.position.set(towerX, y, 0)
    platform.receiveShadow = true
    platform.userData.persistent = true
    scene.add(platform)
    objs.floors.push(platform)
  }

  // X-braces
  const BRACE_Y = [10, 22, 34, 46]
  for (const y of BRACE_Y) {
    const y0 = y - 4
    const y1 = y + 4
    const braces = [
      [new Vector3(towerX - 2, y0, -2), new Vector3(towerX + 2, y1, -2)],
      [new Vector3(towerX + 2, y0, -2), new Vector3(towerX - 2, y1, -2)],
      [new Vector3(towerX - 2, y0, 2), new Vector3(towerX + 2, y1, 2)],
      [new Vector3(towerX + 2, y0, 2), new Vector3(towerX - 2, y1, 2)],
      [new Vector3(towerX - 2, y0, -2), new Vector3(towerX - 2, y1, 2)],
      [new Vector3(towerX - 2, y0, 2), new Vector3(towerX - 2, y1, -2)],
      [new Vector3(towerX + 2, y0, -2), new Vector3(towerX + 2, y1, 2)],
      [new Vector3(towerX + 2, y0, 2), new Vector3(towerX + 2, y1, -2)],
    ]
    for (const [start, end] of braces) {
      toMerge.push(beamBetween(start, end, 0.12, MAT.metalDark))
    }
  }

  // Swing arm
  const arm = new Mesh(new BoxGeometry(12, 0.3, 1.0), MAT.metalLight)
  arm.position.set(towerX + 4, 48, 0)
  arm.userData.persistent = true
  scene.add(arm)

  // Tower ladder rungs (instanced)
  const rungGeo = new CylinderGeometry(0.05, 0.05, 4.2, 4)
  const rungCount = 25
  const rungs = new InstancedMesh(rungGeo, MAT.metalRung, rungCount)
  const dummy = new Object3D()
  for (let i = 0; i < rungCount; i++) {
    dummy.position.set(towerX - 3.1, 1 + i * 2, 0)
    dummy.rotation.set(0, 0, Math.PI / 2)
    dummy.updateMatrix()
    rungs.setMatrixAt(i, dummy.matrix)
  }
  rungs.userData.persistent = true
  scene.add(rungs)

  // Tower strobes / warning lights
  for (let y = 10; y <= 50; y += 10) {
    const strobe = new Mesh(new SphereGeometry(0.2, 6, 6), MAT.strobe)
    strobe.position.set(towerX - 2.5, y, 0)
    strobe.userData.persistent = true
    toMerge.push(strobe)
  }

  // ── Mission Control building ──
  const mcBase = new Mesh(new BoxGeometry(30, 10, 20), MAT.concrete)
  mcBase.position.set(-50, 5, -15)
  mcBase.receiveShadow = true
  mcBase.castShadow = true
  mcBase.userData.persistent = true
  scene.add(mcBase)
  objs.boxes.push(mcBase)

  // MC roof
  const mcRoof = new Mesh(new BoxGeometry(32, 0.3, 22), MAT.concrete)
  mcRoof.position.set(-50, 10.15, -15)
  mcRoof.userData.persistent = true
  toMerge.push(mcRoof)

  // Satellite dish
  const dish = new Mesh(new CylinderGeometry(3, 0, 0.5, 16), MAT.antenna)
  dish.position.set(-40, 14, -15)
  dish.userData.persistent = true
  toMerge.push(dish)
  const dishPole = new Mesh(new CylinderGeometry(0.1, 0.1, 3, 6), MAT.antenna)
  dishPole.position.set(-40, 12, -15)
  dishPole.userData.persistent = true
  toMerge.push(dishPole)

  // MC windows
  for (let i = 0; i < 8; i++) {
    const win = new Mesh(new BoxGeometry(2, 1.5, 0.1), MAT.glass)
    win.position.set(-50 - 12 + i * 3.5, 7, -5)
    win.userData.persistent = true
    toMerge.push(win)
    const glow = new Mesh(new BoxGeometry(1.8, 1.3, 0.05), MAT.windowGlow)
    glow.position.set(-50 - 12 + i * 3.5, 7, -4.9)
    glow.userData.persistent = true
    toMerge.push(glow)
  }

  // Sign
  const sign = new Mesh(new BoxGeometry(12, 1, 0.12), MAT.sign)
  sign.position.set(-50, 10.15, -5)
  sign.userData.persistent = true
  toMerge.push(sign)

  // Antenna
  const antenna = new Mesh(new CylinderGeometry(0.06, 0.06, 6, 6), MAT.antenna)
  antenna.position.set(-50, 13, -15)
  antenna.userData.persistent = true
  toMerge.push(antenna)
  const antennaBall = new Mesh(new SphereGeometry(0.2, 8, 8), MAT.antennaBall)
  antennaBall.position.set(-50, 16.1, -15)
  antennaBall.userData.persistent = true
  toMerge.push(antennaBall)

  // ── Fuel tanks ──
  for (const [x, z, r, h] of [[10, -20, 3, 12], [20, -10, 2, 8], [15, -30, 2.5, 10]]) {
    const tank = new Mesh(new CylinderGeometry(r, r, h, 16), MAT.tankBody)
    tank.position.set(x, h / 2, z)
    tank.userData.persistent = true
    scene.add(tank)
    objs.boxes.push(tank)
  }

  // ── Perimeter fence (instanced) ──
  const fenceGeo = new BoxGeometry(0.15, 2.5, 0.15)
  const fenceCount = 40
  const fence = new InstancedMesh(fenceGeo, MAT.postFence, fenceCount)
  for (let i = 0; i < fenceCount; i++) {
    const angle = (i / fenceCount) * Math.PI * 2
    dummy.position.set(Math.sin(angle) * 90, 1.25, Math.cos(angle) * 90)
    dummy.rotation.set(0, -angle, 0)
    dummy.updateMatrix()
    fence.setMatrixAt(i, dummy.matrix)
  }
  fence.userData.persistent = true
  scene.add(fence)

  // ── Road ──
  const road = new Mesh(new PlaneGeometry(12, 120), MAT.road)
  road.rotation.x = -Math.PI / 2
  road.position.set(30, 0.01, 10)
  road.rotation.z = Math.PI * 0.15
  road.userData.persistent = true
  scene.add(road)

  // ── Lights ──
  const sun = new DirectionalLight(0xffe8c0, 0.9)
  sun.position.set(60, 80, 40)
  sun.castShadow = true
  sun.shadow.mapSize.set(512, 512)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far  = 200
  sun.shadow.camera.left = -80
  sun.shadow.camera.right = 80
  sun.shadow.camera.top = 80
  sun.shadow.camera.bottom = -80
  sun.shadow.bias = -0.0005
  sun.userData.persistent = true
  scene.add(sun)

  const facilityAmbient = new AmbientLight(0x0a1628, 0.7)
  facilityAmbient.userData.persistent = true
  scene.add(facilityAmbient)

  const facilityHemi = new HemisphereLight(0x8ab4d4, 0x1a2a18, 0.8)
  facilityHemi.userData.persistent = true
  scene.add(facilityHemi)

  // Tower base lights
  const towerLight1 = new PointLight(0xff4400, 2, 25)
  towerLight1.position.set(towerX, 2, 0)
  towerLight1.userData.persistent = true
  scene.add(towerLight1)

  const towerLight2 = new PointLight(0xff4400, 2, 25)
  towerLight2.position.set(towerX, 2, 4)
  towerLight2.userData.persistent = true
  scene.add(towerLight2)

  // MC light
  const mcLight = new PointLight(0x44aaff, 1.5, 40)
  mcLight.position.set(-50, 4, -15)
  mcLight.userData.persistent = true
  scene.add(mcLight)

  // ── Merge decorative meshes ──
  if (toMerge.length > 0) {
    const merged = mergeByMaterial(toMerge)
    for (const m of merged) {
      m.userData.persistent = true
      scene.add(m)
    }
  }

  addStars(scene)

  return objs
}
