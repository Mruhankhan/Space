#!/usr/bin/env node
// scripts/build-models.mjs
// Procedurally builds placeholder .glb assets matching the existing
// primitive geometry in src/world.js and src/rocket.js, then writes
// them as binary glTF (glb) via three's GLTFExporter.
//
// Run:  node scripts/build-models.mjs            (idempotent)
//       node scripts/build-models.mjs --force   (rewrite all)

import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Blob } from 'node:buffer'

// ── DOM polyfills for Node ──
// GLTFExporter produces a Blob then reads it via FileReader. Provide a tiny
// FileReader shim that delegates to Blob.arrayBuffer() and fires both
// onload + onloadend (GLTFExporter uses onloadend).
class FileReader {
  constructor() {
    this.result = null
    this.readyState = 0
    this.onload = null
    this.onloadend = null
    this.onerror = null
  }
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(
      (buf) => {
        this.result = buf
        this.readyState = 2
        const evt = { target: this }
        if (typeof this.onload === 'function') this.onload(evt)
        if (typeof this.onloadend === 'function') this.onloadend(evt)
      },
      (err) => {
        this.readyState = 2
        if (typeof this.onerror === 'function') this.onerror(err)
        if (typeof this.onloadend === 'function') this.onloadend({ target: this })
      },
    )
  }
}
if (typeof globalThis.FileReader === 'undefined') globalThis.FileReader = FileReader

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'models')
const FORCE = process.argv.includes('--force')

// Import three + GLTFExporter from node_modules.
// These are pure ESM and don't touch the DOM when no textures are involved.
// On Windows, dynamic import() of absolute paths requires a file:// URL.
const THREE = await import(pathToFileURL(join(ROOT, 'node_modules', 'three', 'build', 'three.module.js')).href)
const { GLTFExporter } = await import(pathToFileURL(join(ROOT, 'node_modules', 'three', 'examples', 'jsm', 'exporters', 'GLTFExporter.js')).href)

const {
  Group, Mesh, MeshStandardMaterial,
  BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
  TorusGeometry, CircleGeometry, PlaneGeometry, CapsuleGeometry,
  Color,
} = THREE

const exporter = new GLTFExporter()

// ── Material helpers ──
function bodyMat(hex = 0xe8e8e8) {
  const m = new MeshStandardMaterial({ color: hex, roughness: 0.35, metalness: 0.85 })
  m.userData = { role: 'body' }
  return m
}
function accentMat(hex = 0x1a1a2e) {
  const m = new MeshStandardMaterial({ color: hex, roughness: 0.35, metalness: 0.85 })
  m.userData = { role: 'accent' }
  return m
}
function standardMat(hex = 0x555555, opts = {}) {
  return new MeshStandardMaterial({ color: hex, roughness: opts.roughness ?? 0.5, metalness: opts.metalness ?? 0.6 })
}

// ── Mesh helpers ──
function mesh(g, m, x = 0, y = 0, z = 0, name = '') {
  const r = new Mesh(g, m)
  r.position.set(x, y, z)
  if (name) r.name = name
  return r
}

// ── Builders ──
function buildRocketExterior() {
  const g = new Group()
  g.name = 'rocket-exterior'

  const body = bodyMat(0xe8e8e8)
  const accent = accentMat(0x1a1a2e)
  const dark = standardMat(0x444455)

  g.add(mesh(new ConeGeometry(1.0, 4, 16), body, 0, 22, 0, 'nosecone'))
  g.add(mesh(new CylinderGeometry(1.0, 1.0, 6, 16), body, 0, 17, 0, 'fairing'))
  g.add(mesh(new CylinderGeometry(1.0, 1.0, 12, 16), body, 0, 8, 0, 'tank1'))
  g.add(mesh(new CylinderGeometry(1.05, 1.05, 0.4, 16), accent, 0, 14, 0, 'ring'))
  g.add(mesh(new CylinderGeometry(0.85, 0.85, 8, 16), body, 0, 18.5, 0, 'tank2'))
  g.add(mesh(new CylinderGeometry(1.0, 1.2, 1.5, 16), dark, 0, 1.5, 0, 'engine-mount'))

  // Engine bells (9 cones).
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const b = mesh(new ConeGeometry(0.22, 0.8, 8), standardMat(0x333344), Math.sin(a) * 0.7, 0.2, Math.cos(a) * 0.7, `bell-${i}`)
    b.rotation.x = Math.PI
    g.add(b)
  }
  // Fins.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const f = mesh(new BoxGeometry(0.08, 1.2, 1.2), standardMat(0x666677), Math.sin(a) * 1.1, 12, Math.cos(a) * 1.1, `fin-${i}`)
    f.rotation.y = a
    g.add(f)
  }
  // Landing legs.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const l = mesh(new BoxGeometry(0.08, 2.5, 0.08), standardMat(0x555566), Math.sin(a) * 1.4, 1.25, Math.cos(a) * 1.4, `leg-${i}`)
    l.rotation.z = Math.cos(a) * 0.35
    l.rotation.x = Math.sin(a) * 0.35
    g.add(l)
  }
  // Stripes.
  for (let i = 0; i < 3; i++) {
    g.add(mesh(new CylinderGeometry(1.01, 1.01, 0.15, 16), accent, 0, 4 + i * 3.5, 0, `stripe-${i}`))
  }
  return g
}

function buildCockpit() {
  const g = new Group()
  g.name = 'rocket-cockpit'
  const console = standardMat(0x0d2040, { roughness: 0.7 })
  const seat = standardMat(0x1a2030, { roughness: 0.7 })
  const win = standardMat(0x002244, { roughness: 0.1, metalness: 0.0 })

  g.add(mesh(new CylinderGeometry(0.9, 0.9, 0.15, 12), standardMat(0x151c28, { roughness: 0.9 }), 0, 18.08, 0, 'cockpit-floor'))
  g.add(mesh(new BoxGeometry(0.5, 0.15, 0.5), seat, 0, 18.25, -0.2, 'seat-base'))
  g.add(mesh(new BoxGeometry(0.5, 0.7, 0.08), seat, 0, 18.6, -0.44, 'seat-back'))
  g.add(mesh(new CircleGeometry(0.35, 16), win, 0, 20, 0.85, 'window'))
  g.add(mesh(new BoxGeometry(1.4, 0.5, 0.1), console, 0, 18.7, 0.55, 'panel'))
  g.add(mesh(new BoxGeometry(1.0, 0.3, 0.02), console, 0, 18.75, 0.5, 'screen'))
  // Interactive flight console.
  const fc = mesh(new BoxGeometry(1.2, 0.5, 0.12), console, 0, 18.7, 0.9, 'cockpit-launch-console')
  fc.rotation.y = Math.PI
  fc.userData = { isConsole: true, consoleId: 'cockpit-launch-console' }
  g.add(fc)
  return g
}

function buildCabin() {
  const g = new Group()
  g.name = 'rocket-cabin'
  const console = standardMat(0x0d2040, { roughness: 0.7 })
  g.add(mesh(new CylinderGeometry(0.9, 0.9, 0.15, 12), standardMat(0x151c28, { roughness: 0.9 }), 0, 10.08, 0, 'cabin-floor'))
  // 4 cabin consoles — each tagged as an interactive.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const c = mesh(new BoxGeometry(0.6, 0.8, 0.12), console,
      Math.sin(a) * 0.75, 10.6, Math.cos(a) * 0.75,
      `cabin-console-${i + 1}`)
    c.rotation.y = a
    c.userData = { isConsole: true, consoleId: `cabin-console-${i + 1}` }
    g.add(c)
  }
  // Ladder rungs.
  for (let i = 0; i < 10; i++) {
    g.add(mesh(new CylinderGeometry(0.04, 0.04, 0.5, 4), standardMat(0x334455, { metalness: 0.6 }), 0.8, 10.5 + i * 0.8, 0, `ladder-${i}`))
  }
  // Hatch.
  g.add(mesh(new CylinderGeometry(0.36, 0.35, 0.08, 12), standardMat(0x223344, { metalness: 0.6 }), 0, 10.04, 0.65, 'hatch'))
  return g
}

function buildEngineering() {
  const g = new Group()
  g.name = 'rocket-engineering'
  g.add(mesh(new CylinderGeometry(0.9, 0.9, 0.15, 12), standardMat(0x151c28, { roughness: 0.9 }), 0, 3.08, 0, 'eng-floor'))
  const core = mesh(new SphereGeometry(0.3, 12, 12),
    new MeshStandardMaterial({ color: 0x002255, emissive: 0x0066ff, emissiveIntensity: 2, transparent: true, opacity: 0.85 }),
    0, 5.0, 0, 'core')
  g.add(core)
  return g
}

function buildHangar() {
  const g = new Group()
  g.name = 'hangar'
  g.add(mesh(new CylinderGeometry(2.5, 2.8, 0.4, 32), standardMat(0x0a1828, { metalness: 0.9 }), 0, 0, 0, 'pedestal'))
  g.add(mesh(new TorusGeometry(2.6, 0.05, 6, 64), standardMat(0x00aaff, { emissive: 0x00aaff, emissiveIntensity: 1.2 }), 0, 0.22, 0, 'ped-ring'))
  return g
}

function buildFacilityTower() {
  const g = new Group()
  g.name = 'facility-tower'
  const col = standardMat(0x445566, { metalness: 0.8 })
  const plat = standardMat(0x586b78, { metalness: 0.7 })
  const towerX = -12
  for (let ix = 0; ix < 2; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      g.add(mesh(new BoxGeometry(0.8, 50, 0.8), col, towerX - 2 + ix * 4, 25, -2 + iz * 4, `tower-col-${ix}-${iz}`))
    }
  }
  for (let y = 0; y <= 50; y += 6) {
    g.add(mesh(new BoxGeometry(5, 0.2, 5), plat, towerX, y, 0, `tower-platform-${y}`))
  }
  // Ladder rungs.
  for (let i = 0; i < 25; i++) {
    g.add(mesh(new CylinderGeometry(0.05, 0.05, 4.2, 4), standardMat(0x556677, { metalness: 0.6 }), towerX - 3.1, 1 + i * 2, 0, `tower-rung-${i}`))
  }
  // Swing arm.
  g.add(mesh(new BoxGeometry(12, 0.3, 1.0), standardMat(0x7890a0, { metalness: 0.85 }), towerX + 4, 48, 0, 'swing-arm'))
  return g
}

function buildFacilityMC() {
  const g = new Group()
  g.name = 'facility-mc'
  const concrete = standardMat(0x87919a, { metalness: 0.04, roughness: 0.9 })
  const glass = standardMat(0x88aacc, { metalness: 0.1, roughness: 0.05 })

  g.add(mesh(new BoxGeometry(24, 8, 16), concrete, -50, 4, -15, 'mc-base'))
  for (let i = 0; i < 8; i++) {
    g.add(mesh(new BoxGeometry(2, 1.5, 0.1), glass, -50 - 10 + i * 3, 5, -7, `mc-window-${i}`))
  }
  g.add(mesh(new BoxGeometry(12, 1, 0.12),
    new MeshStandardMaterial({ color: 0x112238, emissive: 0x0aa7ff, emissiveIntensity: 0.55 }),
    -50, 8.9, -6.88, 'mc-sign'))
  g.add(mesh(new CylinderGeometry(0.06, 0.06, 6, 6), standardMat(0x889aaa, { metalness: 0.7 }), -50, 11, -15, 'mc-antenna'))
  return g
}

function buildFacilityLaunchpad() {
  const g = new Group()
  g.name = 'facility-launchpad'
  const concrete = standardMat(0x87919a, { metalness: 0.04, roughness: 0.9 })
  g.add(mesh(new CylinderGeometry(18, 18, 0.6, 32), concrete, 0, 0, 0, 'launchpad'))
  for (const r of [4, 8, 12]) {
    g.add(mesh(new TorusGeometry(r, 0.1, 4, 64),
      new MeshStandardMaterial({ color: 0x666655 }), 0, 0.35, 0, `pad-ring-${r}`))
  }
  return g
}

function buildAstronaut() {
  const g = new Group()
  g.name = 'astronaut'
  const suit = standardMat(0xe8ece8, { metalness: 0.2, roughness: 0.6 })
  const dark = standardMat(0x223344, { metalness: 0.5, roughness: 0.7 })
  const visor = standardMat(0x002244, { metalness: 0.0, roughness: 0.05 })

  g.add(mesh(new CapsuleGeometry(0.26, 0.5, 6, 12), suit, 0, 0.76, 0, 'body'))
  g.add(mesh(new SphereGeometry(0.22, 14, 14), suit, 0, 1.42, 0, 'helmet'))
  g.add(mesh(new SphereGeometry(0.19, 14, 14, 0, Math.PI * 1.2, 0.3, Math.PI * 0.55), visor, 0, 1.42, 0.06, 'visor'))
  g.add(mesh(new BoxGeometry(0.35, 0.4, 0.12), dark, 0, 0.85, -0.3, 'pack'))
  for (const [side, x] of [['L', -0.36], ['R', 0.36]]) {
    const arm = mesh(new CapsuleGeometry(0.1, 0.38, 4, 8), suit, x, 0.82, 0, `arm-${side}`)
    arm.rotation.z = side === 'L' ? 0.3 : -0.3
    g.add(arm)
  }
  for (const [side, x] of [['L', -0.14], ['R', 0.14]]) {
    g.add(mesh(new CapsuleGeometry(0.12, 0.42, 4, 8), suit, x, 0.28, 0, `leg-${side}`))
    g.add(mesh(new BoxGeometry(0.18, 0.12, 0.28), dark, x, 0.06, 0.04, `boot-${side}`))
  }
  return g
}

function buildConsole() {
  const g = new Group()
  g.name = 'console'
  const m = standardMat(0x0d2040, { roughness: 0.7, metalness: 0.5 })
  g.add(mesh(new BoxGeometry(0.6, 0.8, 0.12), m, 0, 0.4, 0, 'console-body'))
  g.add(mesh(new BoxGeometry(0.45, 0.55, 0.02),
    new MeshStandardMaterial({ color: 0x001133, emissive: 0x00aaff, emissiveIntensity: 1.0, roughness: 0.6, metalness: 0.3 }),
    0, 0.45, 0, 'console-screen'))
  return g
}

// ── Export helper ──
async function exportGlb(group, outPath) {
  const buf = await new Promise((resolve, reject) => {
    exporter.parse(
      group,
      (result) => resolve(result),
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
      { binary: true },
    )
  })
  if (!(buf instanceof ArrayBuffer)) {
    throw new Error(`GLTFExporter returned ${typeof buf} instead of ArrayBuffer`)
  }
  writeFileSync(outPath, Buffer.from(buf))
  return statSync(outPath).size
}

// ── Main ──
const MODELS = [
  ['rocket-exterior',    buildRocketExterior],
  ['rocket-cockpit',     buildCockpit],
  ['rocket-cabin',       buildCabin],
  ['rocket-engineering', buildEngineering],
  ['hangar',             buildHangar],
  ['facility-tower',     buildFacilityTower],
  ['facility-mc',        buildFacilityMC],
  ['facility-launchpad', buildFacilityLaunchpad],
  ['astronaut',          buildAstronaut],
  ['console',            buildConsole],
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  let written = 0, skipped = 0, failed = 0
  for (const [name, build] of MODELS) {
    const outPath = join(OUT, `${name}.glb`)
    if (existsSync(outPath) && !FORCE) {
      console.log(`[build-models] skip ${name}.glb (exists, pass --force to overwrite)`)
      skipped++
      continue
    }
    try {
      const group = build()
      const size = await exportGlb(group, outPath)
      console.log(`[build-models] ${name}.glb  (${(size / 1024).toFixed(1)} KB)`)
      written++
    } catch (e) {
      console.error(`[build-models] FAILED ${name}:`, e?.message || e)
      failed++
    }
  }
  console.log(`[build-models] wrote ${written}, skipped ${skipped}, failed ${failed} → ${OUT}`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('[build-models] fatal:', err)
  process.exit(1)
})