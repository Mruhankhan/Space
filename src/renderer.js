// renderer.js — Three.js renderer, camera, scene, lighting

import { AmbientLight, Color, FogExp2, PerspectiveCamera, Scene, WebGLRenderer, PCFShadowMap, ACESFilmicToneMapping, SRGBColorSpace } from 'three'

let _renderer, _scene, _camera, _animId, _resizeHandler

export const renderer = {
  scene: null,
  camera: null,
  renderer: null,
  _ready: false,

  init() {
    if (this._ready) return

    const canvas = document.getElementById('three-canvas')

    // Scene
    _scene = new Scene()
    _scene.fog = new FogExp2(0x020c1b, 0.018)
    this.scene = _scene

    // Camera
    _camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
    _camera.position.set(0, 5, 20)
    this.camera = _camera

    // Renderer
    _renderer = new WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio <= 1.5,
      alpha: false,
      powerPreference: 'high-performance',
    })
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    _renderer.setSize(window.innerWidth, window.innerHeight)
    _renderer.shadowMap.enabled = true
    _renderer.shadowMap.type = PCFShadowMap
    _renderer.toneMapping = ACESFilmicToneMapping
    _renderer.toneMappingExposure = 1.35
    _renderer.outputColorSpace = SRGBColorSpace
    this.renderer = _renderer

    // Ambient base lighting
    const ambient = new AmbientLight(0x0a1628, 0.8)
    ambient.userData.persistent = true
    _scene.add(ambient)

    // Resize
    _resizeHandler = this._onResize.bind(this)
    window.addEventListener('resize', _resizeHandler)
    this._ready = true
  },

  _onResize() {
    _camera.aspect = window.innerWidth / window.innerHeight
    _camera.updateProjectionMatrix()
    _renderer.setSize(window.innerWidth, window.innerHeight)
  },

  /** Start the render loop, calling onTick(delta) each frame */
  startLoop(onTick) {
    this.stopLoop()
    let last = performance.now()
    const loop = (now) => {
      _animId = requestAnimationFrame(loop)
      const delta = Math.min((now - last) / 1000, 0.05)
      last = now
      onTick(delta)
      _renderer.render(_scene, _camera)
    }
    _animId = requestAnimationFrame(loop)
  },

  stopLoop() {
    if (_animId) { cancelAnimationFrame(_animId); _animId = null }
  },

  /** Clear all non-persistent scene objects (lights can be kept) */
  clearScene() {
    const toRemove = []
    _scene.traverse(obj => {
      if (obj !== _scene && !obj.userData.persistent) toRemove.push(obj)
    })
    toRemove.forEach(obj => {
      _scene.remove(obj)
      obj.geometry?.dispose?.()
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.())
      else obj.material?.dispose?.()
    })
  },

  disposeObject(obj) {
    obj.traverse(child => {
      child.geometry?.dispose?.()
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose?.())
      else child.material?.dispose?.()
    })
  },

  setFog(color, density) {
    _scene.fog = new FogExp2(color, density)
    _scene.background = new Color(color)
  },
}
