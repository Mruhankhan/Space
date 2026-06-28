// input.js — frame-based input system
// Raw mouse delta + key state, polled every render frame.
// No buffering, no allocations on the hot path.

const _keys = new Set()
const _pressed = new Set()
let _enabled = true
let _pointerLocked = false
let _coarsePointer = false

// Touch axes (driven by the on-screen joysticks).
// Each is in [-1, 1] in (x: strafe, y: forward/back) space, same convention
// as the keyboard axis. `_touchLook` is in normalised rad/s (used directly
// in character.update; not converted to a delta accumulator).
const _touchMove = { x: 0, y: 0 }
const _touchLook = { x: 0, y: 0 }

// Persistent mouse delta accumulator (mutated in place, never re-allocated).
const _mouseDelta = { x: 0, y: 0 }
const _mousePos = { x: 0, y: 0 }
const _mouseButtons = { left: false, right: false, middle: false }

// Reusable output objects so consumers don't allocate per frame.
const _moveAxis = { x: 0, y: 0 }
const _lookAxis = { x: 0, y: 0 }
const _returnedDelta = { x: 0, y: 0 }

const _actions = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack:    ['KeyS', 'ArrowDown'],
  moveLeft:    ['KeyA', 'ArrowLeft'],
  moveRight:   ['KeyD', 'ArrowRight'],
  jump:        ['Space'],
  interact:    ['KeyE'],
  sprint:      ['ShiftLeft', 'ShiftRight'],
  pause:       ['Escape'],
  launch:      ['KeyF'],
}

const GAMEPAD_DEADZONE = 0.18
const GAMEPAD_LOOK_GAIN = 4.5

const _gp = {
  leftX: 0, leftY: 0,
  rightX: 0, rightY: 0,
  a: 0, b: 0, x: 0, y: 0,
}

function _applyDeadzone(v) {
  if (Math.abs(v) < GAMEPAD_DEADZONE) return 0
  return v > 0
    ? (v - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)
    : (v + GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)
}

function _pollGamepad() {
  const pads = (typeof navigator.getGamepads === 'function') ? navigator.getGamepads() : null
  if (!pads) return
  const gp = pads[0]
  if (!gp || !gp.axes) return
  _gp.leftX  = _applyDeadzone(gp.axes[0] || 0)
  _gp.leftY  = _applyDeadzone(gp.axes[1] || 0)
  _gp.rightX = _applyDeadzone(gp.axes[2] || 0)
  _gp.rightY = _applyDeadzone(gp.axes[3] || 0)
  if (gp.buttons) {
    _gp.a = gp.buttons[0] ? gp.buttons[0].value : 0
    _gp.b = gp.buttons[1] ? gp.buttons[1].value : 0
    _gp.x = gp.buttons[2] ? gp.buttons[2].value : 0
    _gp.y = gp.buttons[3] ? gp.buttons[3].value : 0
  }
}

// ── Event listeners (registered once at module load) ──────
window.addEventListener('keydown', e => {
  if (e.repeat) return
  if (!_enabled) { _keys.clear(); _pressed.clear(); return }
  if (!_keys.has(e.code)) _pressed.add(e.code)
  _keys.add(e.code)
  if (e.code === 'Space') e.preventDefault()
})

window.addEventListener('keyup', e => {
  _keys.delete(e.code)
})

window.addEventListener('blur', () => {
  _keys.clear()
  _pressed.clear()
  _mouseDelta.x = 0
  _mouseDelta.y = 0
})

window.addEventListener('mousemove', e => {
  if (!_enabled) return
  if (_pointerLocked) {
    _mouseDelta.x += e.movementX
    _mouseDelta.y += e.movementY
  } else {
    _mousePos.x = e.clientX
    _mousePos.y = e.clientY
  }
})

window.addEventListener('mousedown', e => {
  if (e.button === 0) _mouseButtons.left = true
  if (e.button === 1) _mouseButtons.middle = true
  if (e.button === 2) _mouseButtons.right = true
})

window.addEventListener('mouseup', e => {
  if (e.button === 0) _mouseButtons.left = false
  if (e.button === 1) _mouseButtons.middle = false
  if (e.button === 2) _mouseButtons.right = false
})

window.addEventListener('contextmenu', e => {
  if (_enabled) e.preventDefault()
})

document.addEventListener('pointerlockchange', () => {
  _pointerLocked = document.pointerLockElement !== null
})

// Detect coarse-pointer (touch) devices once at load. Cached for the session.
try {
  if (typeof window.matchMedia === 'function') {
    _coarsePointer = window.matchMedia('(pointer: coarse)').matches
    window.matchMedia('(pointer: coarse)').addEventListener?.('change', e => {
      _coarsePointer = e.matches
    })
  }
} catch {}

const _canvas = () => document.getElementById('three-canvas')

_canvas()?.addEventListener?.('pointerdown', e => {
  if (!_enabled || _pointerLocked) return
  if (e.button !== 0) return
  const c = _canvas()
  if (e.target !== c) return
  c.requestPointerLock?.()
})

// ── Public API ─────────────────────────────────────────────
export const input = {
  /** Called once per render frame, before consumers read state. */
  update() {
    _pollGamepad()
  },

  isKey(code) { return _keys.has(code) },

  isAction(name) {
    if (!_enabled) return false
    const codes = _actions[name]
    if (!codes) return false
    for (let i = 0; i < codes.length; i++) {
      if (_keys.has(codes[i])) return true
    }
    if (name === 'jump'     && _gp.a > 0.5) return true
    if (name === 'interact' && _gp.x > 0.5) return true
    if (name === 'sprint'   && _gp.y > 0.5) return true
    return false
  },

  consumeAction(name) {
    if (!_enabled) return false
    const codes = _actions[name]
    if (!codes) return false
    let hit = false
    for (let i = 0; i < codes.length; i++) {
      if (_pressed.has(codes[i])) hit = true
      _pressed.delete(codes[i])
    }
    return hit
  },

  /**
   * Movement axis in camera-relative space.
   * y < 0 = forward, y > 0 = back, x < 0 = left, x > 0 = right.
   * Returns a shared object (do not mutate / retain).
   * Mixes keyboard + gamepad + touch joystick.
   */
  getMoveAxis() {
    if (!_enabled) { _moveAxis.x = 0; _moveAxis.y = 0; return _moveAxis }
    let x = 0, y = 0
    if (_keys.has('KeyW') || _keys.has('ArrowUp'))    y -= 1
    if (_keys.has('KeyS') || _keys.has('ArrowDown'))  y += 1
    if (_keys.has('KeyA') || _keys.has('ArrowLeft'))  x -= 1
    if (_keys.has('KeyD') || _keys.has('ArrowRight')) x += 1

    if (x === 0 && y === 0) {
      x = _gp.leftX
      y = _gp.leftY
    } else {
      const len = Math.sqrt(x * x + y * y)
      if (len > 1) { x /= len; y /= len }
    }
    // Mix in touch joystick (touch dominates when present so it overrides kb).
    if (_touchMove.x !== 0 || _touchMove.y !== 0) {
      x = _touchMove.x
      y = _touchMove.y
    }
    _moveAxis.x = x
    _moveAxis.y = y
    return _moveAxis
  },

  /** Gamepad look axis (already deadzoned), mixed with touch look. */
  getLookAxis() {
    _lookAxis.x = _gp.rightX * GAMEPAD_LOOK_GAIN + _touchLook.x
    _lookAxis.y = _gp.rightY * GAMEPAD_LOOK_GAIN + _touchLook.y
    return _lookAxis
  },

  /** Mouse delta accumulated since last frame (shared object, not allocated). */
  getMouseDelta() {
    return _mouseDelta
  },

  /** Reads then zeroes the accumulated mouse delta. */
  consumeMouseDelta() {
    _returnedDelta.x = _mouseDelta.x
    _returnedDelta.y = _mouseDelta.y
    _mouseDelta.x = 0
    _mouseDelta.y = 0
    return _returnedDelta
  },

  isSprinting() {
    return this.isAction('sprint')
  },

  isPointerLocked() {
    return _pointerLocked
  },

  isMouseDown(button = 'left') {
    return _mouseButtons[button] === true
  },

  requestPointerLock() {
    if (_coarsePointer) return false
    if (document.pointerLockElement) return true
    _canvas()?.requestPointerLock?.()
    return true
  },

  exitPointerLock() {
    if (!document.pointerLockElement) return
    document.exitPointerLock?.()
  },

  /**
   * Called by TouchJoystick. Channels: 'move' or 'look'.
   * `x, y` are normalised in [-1, 1].
   *  move: x = strafe, y = forward/back (same convention as keyboard)
   *  look: x = yaw rate, y = pitch rate, scaled later in character.js
   */
  setTouchAxis(channel, x, y) {
    if (channel === 'move') {
      _touchMove.x = Math.max(-1, Math.min(1, x || 0))
      _touchMove.y = Math.max(-1, Math.min(1, y || 0))
    } else if (channel === 'look') {
      _touchLook.x = Math.max(-1, Math.min(1, x || 0))
      _touchLook.y = Math.max(-1, Math.min(1, y || 0))
    }
  },

  clearTouchAxis() {
    _touchMove.x = 0; _touchMove.y = 0
    _touchLook.x = 0; _touchLook.y = 0
  },

  isCoarsePointer() {
    return _coarsePointer
  },

  disable() {
    _enabled = false
    _keys.clear()
    _pressed.clear()
    _mouseDelta.x = 0
    _mouseDelta.y = 0
    _touchMove.x = 0; _touchMove.y = 0
    _touchLook.x = 0; _touchLook.y = 0
  },

  enable() {
    _enabled = true
  },

  isEnabled() {
    return _enabled
  },
}