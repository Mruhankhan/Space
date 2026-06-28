import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import { game, STATES } from './game.js'
import { getProfile, clearProgress } from './save.js'
import ProfileScreen          from './ui/ProfileScreen.jsx'
import MainMenu               from './ui/MainMenu.jsx'
import HangarScreen           from './ui/HangarScreen.jsx'
import HUD                    from './ui/HUD.jsx'
import { LaunchOverlay, ResultOverlay } from './ui/LaunchOverlay.jsx'

// Default values kept outside component so they are not re-allocated.
const DEFAULT_FACILITY = Object.freeze({
  position: { x: 0, y: 0, z: 0 },
  deckName: null,
  insideRocket: false,
  launchReady: true,
  consoleProgress: 'No system checks required',
})
const DEFAULT_LAUNCH = Object.freeze({
  countdown: 10,
  status: '',
  result: null,
})

export default function App() {
  const [screen, setScreen]   = useState(STATES.LOADING)
  const [profile, setProfile] = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)
  const [facilityData, setFacility] = useState(DEFAULT_FACILITY)
  const [launchData, setLaunch]     = useState(DEFAULT_LAUNCH)
  const [selectedRocket, setRocket] = useState(null)

  // Track screen via ref so we can guard against redundant setState.
  const lastScreenRef = useRef(STATES.LOADING)

  // Register UI callback. We DO NOT setScreen on every facility tick —
  // simulation state is kept in the facilityData object so React only
  // re-renders the HUD which is memoized.
  const handleGameUpdate = useCallback((state, payload) => {
    if (state !== lastScreenRef.current) {
      lastScreenRef.current = state
      setScreen(state)
    }
    if (state === STATES.FACILITY) {
      setFacility(f => {
        let next = f
        if (payload.position) {
          const p = payload.position
          if (f.position.x !== p.x || f.position.y !== p.y || f.position.z !== p.z) {
            next = { ...next, position: p }
          }
        }
        if (payload.deckName !== undefined && payload.deckName !== f.deckName) {
          next = { ...next, deckName: payload.deckName }
        }
        if (payload.insideRocket !== undefined && payload.insideRocket !== f.insideRocket) {
          next = { ...next, insideRocket: payload.insideRocket }
        }
        if (payload.launchReady !== undefined && payload.launchReady !== f.launchReady) {
          next = { ...next, launchReady: payload.launchReady }
        }
        if (payload.consoleProgress !== undefined && payload.consoleProgress !== f.consoleProgress) {
          next = { ...next, consoleProgress: payload.consoleProgress }
        }
        return next === f ? f : next
      })
    }
    if (state === STATES.LAUNCH) {
      setLaunch(l => {
        let next = l
        if (payload.countdown !== undefined && payload.countdown !== l.countdown) {
          next = { ...next, countdown: payload.countdown }
        }
        if (payload.launchStatus !== undefined && payload.launchStatus !== l.status) {
          next = { ...next, status: payload.launchStatus }
        }
        if (payload.result !== undefined && payload.result !== l.result) {
          next = { ...next, result: payload.result }
        }
        return next === l ? l : next
      })
    }
  }, [])

  useEffect(() => {
    game.onUIUpdate(handleGameUpdate)
    game.init().then(() => {
      document.getElementById('loading-screen')?.classList.add('hidden')
      const existing = getProfile()
      if (existing) {
        setProfile(existing)
        game.transition(STATES.MAIN_MENU)
      } else {
        game.transition(STATES.PROFILE)
      }
    })
    return () => game.onUIUpdate(null)
  }, [handleGameUpdate])

  const handleProfileComplete = useCallback((p) => {
    setProfile(p)
    game.transition(STATES.MAIN_MENU)
  }, [])

  const handleMenuNav = useCallback((id) => {
    setActiveMenu(id)
    if (id === 'hangar')   game.transition(STATES.HANGAR)
    if (id === 'facility') game.transition(STATES.FACILITY, { rocket: selectedRocket })
    if (id === 'start')    game.transition(STATES.FACILITY, { rocket: selectedRocket })
  }, [selectedRocket])

  const handleEnterFacility = useCallback((rocket) => {
    setRocket(rocket)
    game.transition(STATES.FACILITY, { rocket })
  }, [])

  const handleLaunch = useCallback(() => {
    setLaunch({ countdown: 10, status: 'LAUNCH SEQUENCE INITIATED', result: null })
    game.startLaunch()
  }, [])

  const handleAbort = useCallback(() => {
    game.returnToMenu()
  }, [])

  const handleReturnToMenu = useCallback(() => {
    setLaunch({ countdown: 10, status: '', result: null })
    game.returnToMenu()
  }, [])

  const handleResetProgress = useCallback(() => {
    const confirmed = window.confirm('Reset all progress and return to the first screen? This will remove your profile, rockets, and mission log.')
    if (!confirmed) return
    clearProgress()
    setProfile(null)
    setActiveMenu(null)
    setRocket(null)
    setLaunch({ countdown: 10, status: '', result: null })
    setFacility(DEFAULT_FACILITY)
    game.transition(STATES.PROFILE)
  }, [])

  return (
    <>
      {screen === STATES.PROFILE && (
        <ProfileScreen onComplete={handleProfileComplete} />
      )}

      {screen === STATES.MAIN_MENU && (
        <MainMenu
          profile={profile}
          activeItem={activeMenu}
          onNavigate={handleMenuNav}
          onResetProgress={handleResetProgress}
        />
      )}

      {screen === STATES.HANGAR && (
        <HangarScreen
          onBack={() => game.transition(STATES.MAIN_MENU)}
          onRocketChange={(rocket) => game.previewRocket(rocket)}
          onTestFacility={handleEnterFacility}
        />
      )}

      {screen === STATES.FACILITY && (
        <HUD
          deck={facilityData.deckName}
          position={facilityData.position}
          insideRocket={facilityData.insideRocket}
          launchReady={facilityData.launchReady}
          consoleProgress={facilityData.consoleProgress}
          onExitToMenu={handleReturnToMenu}
          onLaunch={handleLaunch}
        />
      )}

      {screen === STATES.LAUNCH && !launchData.result && (
        <LaunchOverlay
          countdown={launchData.countdown}
          status={launchData.status}
          onAbort={handleAbort}
        />
      )}

      {screen === STATES.LAUNCH && launchData.result && (
        <ResultOverlay
          result={launchData.result}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </>
  )
}