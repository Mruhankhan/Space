// loaders.js — central asset pipeline.
// GLTFLoader for .glb models, AudioLoader for .wav/.ogg, LoadingManager
// for progress reporting. Each loader has a primitive-builder fallback so
// the app still works before `npm run build:assets` has been run.

import {
  AudioLoader,
  Group,
  LoadingManager,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { buildRocket } from './rocket.js'
import { buildMenuScene, buildHangarScene, buildFacilityScene } from './world.js'

const BASE = import.meta.env.BASE_URL || '/'

// ── LoadingManager (single source of truth for asset progress) ──
export const loadManager = new LoadingManager()
loadManager.onError = (url) => console.warn('[loaders] failed', url)

let _progressListeners = []
loadManager.onProgress = (url, loaded, total) => {
  const ratio = total > 0 ? loaded / total : 0
  for (const cb of _progressListeners) {
    try { cb({ url, loaded, total, ratio }) } catch (e) { console.error(e) }
  }
}
loadManager.onLoad = () => {
  for (const cb of _progressListeners) {
    try { cb({ url: null, loaded: 1, total: 1, ratio: 1, done: true }) } catch (e) { console.error(e) }
  }
}

export function onProgress(cb) {
  _progressListeners.push(cb)
  return () => { _progressListeners = _progressListeners.filter(x => x !== cb) }
}

// ── Internal: GLTF helpers ──
const _gltfLoader = new GLTFLoader(loadManager)

function _loadGLB(url) {
  return new Promise((resolve, reject) => {
    _gltfLoader.load(
      BASE + url,
      (gltf) => resolve(gltf),
      undefined,
      (err) => reject(err),
    )
  })
}

// List of asset URLs for the preload pass (so LoadingManager has a total).
export const ASSET_URLS = [
  'models/rocket-exterior.glb',
  'models/rocket-cockpit.glb',
  'models/rocket-cabin.glb',
  'models/rocket-engineering.glb',
  'models/hangar.glb',
  'models/facility-tower.glb',
  'models/facility-mc.glb',
  'models/facility-launchpad.glb',
  'models/astronaut.glb',
  'models/console.glb',
  'sounds/click.wav',
  'sounds/hover.wav',
  'sounds/success.wav',
  'sounds/error.wav',
  'sounds/confirm.wav',
  'sounds/thruster.wav',
  'sounds/ambient-menu.wav',
  'sounds/ambient-hangar.wav',
  'sounds/ambient-facility.wav',
  'sounds/footstep.wav',
]

// ── Audio ──
const _audioLoader = new AudioLoader(loadManager)
const _audioCache = new Map()  // name → AudioBuffer

// audioContext is created lazily on first resume() call.
let _audioCtx = null
export function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return _audioCtx
}

export async function loadAudio(name) {
  if (_audioCache.has(name)) return _audioCache.get(name)
  const url = `sounds/${name}.wav`
  try {
    const buf = await _audioLoader.loadAsync(BASE + url)
    _audioCache.set(name, buf)
    return buf
  } catch (e) {
    console.warn('[loaders] audio missing:', name)
    return null
  }
}

// ── Models ──
const _modelCache = new Map()  // url → Group

async function _loadGroup(url) {
  if (_modelCache.has(url)) return _modelCache.get(url)
  try {
    const gltf = await _loadGLB(url)
    const root = gltf.scene || gltf.scenes?.[0]
    if (!root) throw new Error('no scene in gltf')
    _modelCache.set(url, root)
    return root
  } catch (e) {
    console.warn('[loaders] model missing:', url)
    return null
  }
}

// loadRocket(config) — merge exterior + 3 interior decks into a single Group.
// Falls back to buildRocket (procedural) if any glb fails to load.
export async function loadRocket(config = {}) {
  const [ext, cockpit, cabin, eng] = await Promise.all([
    _loadGroup('models/rocket-exterior.glb'),
    _loadGroup('models/rocket-cockpit.glb'),
    _loadGroup('models/rocket-cabin.glb'),
    _loadGroup('models/rocket-engineering.glb'),
  ])
  if (!ext && !cockpit) {
    // No glbs available — fall back to procedural.
    return buildRocket(config)
  }
  const group = new Group()
  group.name = config.name || 'Rocket'
  group.userData.config = config
  group.userData.sharedGeometry = true

  for (const part of [ext, cockpit, cabin, eng]) {
    if (part) {
      // Mark every descendant shared.
      part.traverse(obj => {
        if (obj.userData) obj.userData.sharedGeometry = true
        // Tag interactive parts by name.
        if (obj.name && /console/i.test(obj.name)) {
          obj.userData.isConsole = true
          obj.userData.consoleId = obj.name
        }
        if (obj.name && /floor|deck/i.test(obj.name)) {
          obj.userData.isInteriorFloor = true
        }
      })
      group.add(part.clone(true))
    }
  }

  // Apply per-rocket body / accent colors.
  const body = new (await import('three')).Color(config.color || '#e8e8e8').getHex()
  const accent = new (await import('three')).Color(config.accentColor || '#1a1a2e').getHex()
  group.traverse(obj => {
    if (!obj.material) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      if (!m.userData) m.userData = {}
      if (m.userData.role === 'body')   m.color.setHex(body)
      if (m.userData.role === 'accent') m.color.setHex(accent)
    }
  })

  return group
}

// loadSceneAssets(name) — returns { floors, boxes, dispose } like buildXScene.
// Falls back to the inline procedural builder on any glb failure.
export async function loadSceneAssets(name) {
  let floors = [], boxes = []
  if (name === 'facility') {
    const [tower, mc, pad] = await Promise.all([
      _loadGroup('models/facility-tower.glb'),
      _loadGroup('models/facility-mc.glb'),
      _loadGroup('models/facility-launchpad.glb'),
    ])
    if (!tower && !mc && !pad) {
      // Total fallback.
      const scene = buildFacilityScene(_dummyScene())
      return { floors: scene.floors, boxes: scene.boxes }
    }
    floors = []
    boxes = []
    for (const part of [tower, mc, pad]) {
      if (!part) continue
      part.traverse(obj => {
        if (!obj.geometry) return
        if (obj.userData) obj.userData.sharedGeometry = true
        if (obj.name && /floor|pad|ground/i.test(obj.name)) floors.push(obj)
        else boxes.push(obj)
      })
    }
    return { floors, boxes }
  }
  if (name === 'hangar') {
    const hangar = await _loadGroup('models/hangar.glb')
    if (!hangar) {
      const scene = buildHangarScene(_dummyScene())
      return { floors: [], boxes: [] }
    }
    hangar.traverse(obj => {
      if (!obj.geometry) return
      if (obj.userData) obj.userData.sharedGeometry = true
    })
    return { floors: [], boxes: [] }
  }
  if (name === 'menu') {
    const scene = buildMenuScene(_dummyScene())
    return { floors: [], boxes: [] }
  }
  return { floors: [], boxes: [] }
}

function _dummyScene() {
  // Empty stub: scene builders only call scene.add(...). They don't
  // touch scene.children in a way that affects our returned arrays.
  return { add: () => {}, background: null, fog: null }
}

// ── preloadAll ──
// Fires all the loads so the LoadingManager tracks total progress.
// Resolves once LoadingManager.onLoad has fired (or after a small fallback
// timeout if the network never finishes).
export function preloadAll() {
  return new Promise((resolve) => {
    let resolved = false
    const finish = () => { if (!resolved) { resolved = true; resolve() } }
    loadManager.onLoad = () => {
      // Replace the original onLoad (which also notified progress listeners)
      // with our resolver + their notification.
      for (const cb of _progressListeners) {
        try { cb({ url: null, loaded: 1, total: 1, ratio: 1, done: true }) } catch (e) { console.error(e) }
      }
      finish()
    }
    loadManager.onError = (url) => {
      console.warn('[loaders] asset failed:', url)
      // Don't abort — LoadingManager will retry / continue.
    }

    // Kick off all loads. Audio loads need an AudioContext — defer those
    // until the user gesture so we don't fail silently. But for the
    // loading-bar UX, we trigger them here; if they fail, audio falls back.
    Promise.all([
      loadRocket({}).catch(() => null),
      loadSceneAssets('facility').catch(() => ({ floors: [], boxes: [] })),
      loadSceneAssets('hangar').catch(() => ({ floors: [], boxes: [] })),
      loadAudio('click'),
      loadAudio('hover'),
      loadAudio('success'),
      loadAudio('error'),
      loadAudio('confirm'),
      loadAudio('thruster'),
      loadAudio('ambient-menu'),
      loadAudio('ambient-hangar'),
      loadAudio('ambient-facility'),
      loadAudio('footstep'),
    ]).then(finish).catch(finish)

    // Hard fallback in case nothing fires (e.g. no assets to load).
    setTimeout(finish, 8000)
  })
}
