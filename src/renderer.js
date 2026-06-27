// renderer.js — Three.js renderer, camera, scene, lighting

import * as THREE from 'three'

let _renderer, _scene, _camera, _animId

export const renderer = {
  scene: null,
  camera: null,
  renderer: null,

  init() {
    const canvas = document.getElementById('three-canvas')

    // Scene
    _scene = new THREE.Scene()
    _scene.fog = new THREE.FogExp2(0x020c1b, 0.018)
    this.scene = _scene

    // Camera
    _camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
    _camera.position.set(0, 5, 20)
    this.camera = _camera

    // Renderer
    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    _renderer.setSize(window.innerWidth, window.innerHeight)
    _renderer.shadowMap.enabled = true
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap
    _renderer.toneMapping = THREE.ACESFilmicToneMapping
    _renderer.toneMappingExposure = 1.2
    _renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer = _renderer

    // Ambient base lighting
    const ambient = new THREE.AmbientLight(0x0a1628, 0.8)
    _scene.add(ambient)

    // Resize
    window.addEventListener('resize', this._onResize.bind(this))
  },

  _onResize() {
    _camera.aspect = window.innerWidth / window.innerHeight
    _camera.updateProjectionMatrix()
    _renderer.setSize(window.innerWidth, window.innerHeight)
  },

  /** Start the render loop, calling onTick(delta) each frame */
  startLoop(onTick) {
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
    toRemove.forEach(obj => _scene.remove(obj))
  },

  setFog(color, density) {
    _scene.fog = new THREE.FogExp2(color, density)
    _scene.background = new THREE.Color(color)
  },
}
