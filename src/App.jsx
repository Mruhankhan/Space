import React, { useState, useEffect, useCallback } from 'react'
import { game, STATES }       from './game.js'
import { getProfile }         from './save.js'
import ProfileScreen          from './ui/ProfileScreen.jsx'
import MainMenu               from './ui/MainMenu.jsx'
import HangarScreen           from './ui/HangarScreen.jsx'
import HUD                    from './ui/HUD.jsx'
import PilotLog               from './ui/PilotLog.jsx'
import SettingsMenu           from './ui/SettingsMenu.jsx'
import { LaunchOverlay, ResultOverlay } from './ui/LaunchOverlay.jsx'

export default function App() {
  const [screen, setScreen]         = useState(STATES.LOADING)
  const [profile, setProfile_]      = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)
  const [facilityData, setFacility] = useState({
    deckName: null,
    insideRocket: false,
    interactionPrompt: null,
    playerYaw: 0,
    playerPos: { x: 8, z: 8 },
  })
  const [launchData, setLaunch]     = useState({ countdown: 10, status: '', result: null })
  const [selectedRocket, setRocket] = useState(null)
  const [showLog, setShowLog]       = useState(false)
  const [paused, setPaused]         = useState(false)

  // Register UI callback into game.js
  const handleGameUpdate = useCallback((state, payload) => {
    setScreen(state)
    if (state === STATES.FACILITY) {
      if (payload.deckName !== undefined || payload.insideRocket !== undefined ||
          payload.interactionPrompt !== undefined || payload.playerYaw !== undefined ||
          payload.playerPos !== undefined || payload.paused !== undefined) {
        setFacility(f => ({ ...f, ...payload }))
      }
      if (payload.paused !== undefined) {
        setPaused(payload.paused)
      }
    }
    if (state === STATES.LAUNCH) {
      if (payload.paused !== undefined) {
        setPaused(payload.paused)
        return
      }
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
    if (id === 'log')      setShowLog(true)
  }

  function handleEnterFacility(rocket) {
    setRocket(rocket)
    game.transition(STATES.FACILITY, { rocket })
  }

  function handleReturnToMenu() {
    setPaused(false)
    game.transition(STATES.MAIN_MENU)
  }

  function handleLaunch() {
    game.startLaunch()
  }

  function handleAbort() {
    setLaunch({ countdown: 10, status: '', result: null })
    game.transition(STATES.MAIN_MENU)
  }

  function handleSettingsClose() {
    if (paused) {
      game.togglePause()
    }
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
        />
      )}

      {showLog && (
        <PilotLog onClose={() => { setShowLog(false); setActiveMenu(null) }} />
      )}

      {screen === STATES.HANGAR && (
        <HangarScreen
          onBack={() => game.transition(STATES.MAIN_MENU)}
          onRocketChange={(rocket) => game.previewRocket(rocket)}
          onTestFacility={handleEnterFacility}
        />
      )}

      {screen === STATES.FACILITY && !paused && (
        <HUD
          deck={facilityData.deckName}
          insideRocket={facilityData.insideRocket}
          interactionPrompt={facilityData.interactionPrompt}
          playerYaw={facilityData.playerYaw}
          playerPos={facilityData.playerPos}
          onExitToMenu={handleReturnToMenu}
          onLaunch={handleLaunch}
          paused={paused}
        />
      )}

      {(screen === STATES.FACILITY || screen === STATES.LAUNCH) && paused && (
        <SettingsMenu onClose={handleSettingsClose} />
      )}

      {screen === STATES.LAUNCH && !launchData.result && !paused && (
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
