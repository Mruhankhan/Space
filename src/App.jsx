import React, { useState, useEffect, useCallback } from 'react'
import { game, STATES }       from './game.js'
import { getProfile, clearProgress } from './save.js'
import ProfileScreen          from './ui/ProfileScreen.jsx'
import MainMenu               from './ui/MainMenu.jsx'
import HangarScreen           from './ui/HangarScreen.jsx'
import HUD                    from './ui/HUD.jsx'
import { LaunchOverlay, ResultOverlay } from './ui/LaunchOverlay.jsx'

export default function App() {
  const [screen, setScreen]         = useState(STATES.LOADING)
  const [profile, setProfile_]      = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)
  const [facilityData, setFacility] = useState({ position: { x:0,y:0,z:0 }, deckName: null, insideRocket: false })
  const [launchData, setLaunch]     = useState({ countdown: 10, status: '', result: null })
  const [selectedRocket, setRocket] = useState(null)

  // Register UI callback into game.js
  const handleGameUpdate = useCallback((state, payload) => {
    setScreen(state)
    if (state === STATES.FACILITY) {
      if (payload.position || payload.deckName !== undefined || payload.insideRocket !== undefined) {
        setFacility(f => ({ ...f, ...payload }))
      }
    }
    if (state === STATES.LAUNCH) {
      setLaunch(l => ({
        ...l,
        countdown:  payload.countdown  ?? l.countdown,
        status:     payload.launchStatus ?? l.status,
        result:     payload.result      ?? l.result,
      }))
    }
  }, [])

  
  useEffect(() => {
    game.onUIUpdate(handleGameUpdate)
    game.init().then(() => {
      // Hide CSS loading screen
      document.getElementById('loading-screen')?.classList.add('hidden')

      // Check for existing profile
      const existing = getProfile()
      if (existing) {
        setProfile_(existing)
        game.transition(STATES.MAIN_MENU)
      } else {
        game.transition(STATES.PROFILE)
      }
    })
    // Cleanup
    return () => game.onUIUpdate(null)
  }, [handleGameUpdate])

  // ── Navigation handlers ──────────────────────────────────
  function handleProfileComplete(p) {
    setProfile_(p)
    game.transition(STATES.MAIN_MENU)
  }

  function handleMenuNav(id) {
    setActiveMenu(id)
    if (id === 'hangar')   game.transition(STATES.HANGAR)
    if (id === 'facility') game.transition(STATES.FACILITY, { rocket: selectedRocket })
    if (id === 'start')    game.transition(STATES.FACILITY, { rocket: selectedRocket })
  }

  function handleEnterFacility(rocket) {
    setRocket(rocket)
    game.transition(STATES.FACILITY, { rocket })
  }

  function handleLaunch() {
    setLaunch({ countdown: 10, status: 'LAUNCH SEQUENCE INITIATED', result: null })
    game.startLaunch()
  }

  function handleAbort() {
    game.returnToMenu()
  }

  function handleReturnToMenu() {
    setLaunch({ countdown: 10, status: '', result: null })
    game.returnToMenu()
  }

  function handleResetProgress() {
    const confirmed = window.confirm('Reset all progress and return to the first screen? This will remove your profile, rockets, and mission log.')
    if (!confirmed) return

    clearProgress()
    setProfile_(null)
    setActiveMenu(null)
    setRocket(null)
    setLaunch({ countdown: 10, status: '', result: null })
    setFacility({ position: { x: 0, y: 0, z: 0 }, deckName: null, insideRocket: false })
    game.transition(STATES.PROFILE)
  }

  // ── Render ───────────────────────────────────────────────
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




