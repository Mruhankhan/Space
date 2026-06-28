// renderer.js — Three.js renderer + scene + camera + optimized loop
// Strict pipeline: input → camera → movement/physics → render.

import {
  AmbientLight,
  Color,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  PCFSoftShadowMap,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Vector3,
} from 'three'

let _renderer, _scene, _camera
let _animId = null
let _lastFrameTime = 0
let _frame = 0
let _onTick = null

const PERSISTENT = new Set()
const LISTENERS = new Set()

export const renderer = {
  scene: null,
  camera: null,
  renderer: null,
  ready: false,
  lastDelta: 0,
  fps: 60,
  frameCount: 0,

  init() {
    if (this.ready) return

    const canvas = document.getElementById('three-canvas')
    if (!canvas) {
      console.error('[renderer] #three-canvas not found')
      return
    }

    _scene = new Scene()
    _scene.background = new Color(0x020c1b)
    _scene.fog = new FogExp2(0x020c1b, 0.012)
    this.scene = _scene

    _camera = new PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.05,
      1500,
    )
    _camera.position.set(0, 5, 20)
    _camera.rotation.order = 'YXZ'
    this.camera = _camera

    _renderer = new WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio <= 1.5,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      // Required for renderer.getCanvasDataURL() to read pixels after render.
      preserveDrawingBuffer: true,
    })
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    _renderer.setSize(window.innerWidth, window.innerHeight)
    _renderer.shadowMap.enabled = true
    _renderer.shadowMap.type = PCFSoftShadowMap
    _renderer.toneMapping = ACESFilmicToneMapping
    _renderer.toneMappingExposure = 1.25
    _renderer.outputColorSpace = SRGBColorSpace
    _renderer.autoClear = true
    this.renderer = _renderer

    // Persistent ambient + hemisphere lighting.
    const ambient = new AmbientLight(0x223344, 0.9)
    ambient.userData.persistent = true
    _scene.add(ambient)
    PERSISTENT.add(ambient)

    const hemi = new HemisphereLight(0xa8c8ff, 0x1d2030, 0.6)
    hemi.userData.persistent = true
    _scene.add(hemi)
    PERSISTENT.add(hemi)

    window.addEventListener('resize', this._onResize.bind(this))

    this.ready = true
  },

  _onResize() {
    if (!_camera || !_renderer) return
    _camera.aspect = window.innerWidth / window.innerHeight
    _camera.updateProjectionMatrix()
    _renderer.setSize(window.innerWidth, window.innerHeight)
  },

  setFog(color, density) {
    _scene.background = new Color(color)
    _scene.fog = new FogExp2(color, density)
  },

  /**
   * Start the render loop. Each frame:
   *   1. input.update()
   *   2. onTick(delta, time)
   *   3. renderer.render(scene, camera)
   */
  startLoop(onTick) {
    this.stopLoop()
    _onTick = onTick
    _lastFrameTime = performance.now()
    const loop = (now) => {
      _animId = requestAnimationFrame(loop)
      const dt = Math.min((now - _lastFrameTime) / 1000, 0.1)
      _lastFrameTime = now
      this.lastDelta = dt
      this.frameCount = ++_frame
      try {
        if (_onTick) _onTick(dt, now / 1000)
      } catch (err) {
        console.error('[renderer] tick error', err)
      }
      _renderer.render(_scene, _camera)
    }
    _animId = requestAnimationFrame(loop)
  },

  stopLoop() {
    if (_animId) {
      cancelAnimationFrame(_animId)
      _animId = null
    }
  },

  /** Remove every object that isn't flagged persistent. */
  clearScene() {
    const toRemove = []
    _scene.traverse(obj => {
      if (obj === _scene) return
      if (obj.userData && obj.userData.persistent) return
      toRemove.push(obj)
    })
    for (const obj of toRemove) {
      _scene.remove(obj)
      obj.traverse(child => {
        if (child.geometry) child.geometry.dispose?.()
        if (child.material) {
          if (Array.isArray(child.material)) {
            for (const m of child.material) m.dispose?.()
          } else {
            child.material.dispose?.()
          }
        }
      })
    }
  },

  disposeObject(obj) {
    if (!obj) return
    obj.traverse(child => {
      // Skip meshes whose geometry/material is owned by a module-level
      // singleton cache (e.g. rocket.js G()/M()) — disposing them would
      // break every subsequent build of the same kind.
      if (child.userData && child.userData.sharedGeometry) return
      if (child.geometry) child.geometry.dispose?.()
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (const m of child.material) m.dispose?.()
        } else {
          child.material.dispose?.()
        }
      }
    })
  },

  addListener(fn) { LISTENERS.add(fn) },
  removeListener(fn) { LISTENERS.delete(fn) },

  /**
   * Snapshot the current rendered frame as a PNG data URL.
   * Used by the result-share flow.
   * `preserveDrawingBuffer` would let us read at any time; without it,
   * the caller should request immediately after a render call.
   */
  getCanvasDataURL(type = 'image/png', quality = 0.92) {
    if (!_renderer) return null
    const c = _renderer.domElement
    try { return c.toDataURL(type, quality) }
    catch (e) { console.error('[renderer] getCanvasDataURL failed', e); return null }
  },
}