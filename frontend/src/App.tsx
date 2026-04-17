/**
 * App.tsx — root layout shell.
 *
 * F2: Header + main content area + LogPanel + TallyBar.
 * F3: CameraGrid mounted in main.
 * F4: DebugModal — full-screen overlay, triggered from CameraCard gear button.
 * F5: AddCameraWizard — multi-step pairing modal, triggered from Header.
 */
import { useCallback, useEffect, useState } from 'react'
import { useWsStore } from './stores/ws'
import { Header } from './components/Header'
import { CameraGrid } from './panels/cameras/CameraGrid'
import { DebugModal } from './panels/cameras/DebugModal'
import { AddCameraWizard } from './panels/cameras/AddCameraWizard'
import { LogPanel } from './panels/logs/LogPanel'
import { TallyBar } from './panels/TallyBar'

function App() {
  const connect = useWsStore((s) => s.connect)
  useEffect(() => { connect() }, [connect])

  // Debug modal
  const [debugCamId, setDebugCamId] = useState<string | null>(null)
  const openDebug  = useCallback((id: string) => setDebugCamId(id), [])
  const closeDebug = useCallback(() => setDebugCamId(null), [])

  // Add Camera wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const openWizard  = useCallback(() => setWizardOpen(true), [])
  const closeWizard = useCallback(() => setWizardOpen(false), [])

  // Header global actions
  const recAll  = useCallback(() => fetch('/api/cameras/rec-all',  { method: 'POST' }), [])
  const stopAll = useCallback(() => fetch('/api/cameras/stop-all', { method: 'POST' }), [])

  return (
    <>
      <Header onAddCamera={openWizard} onRecAll={recAll} onStopAll={stopAll} />

      <main style={{ padding: '16px' }}>
        <CameraGrid onDebug={openDebug} />
      </main>

      <LogPanel />
      <TallyBar />

      <DebugModal    camId={debugCamId} onClose={closeDebug} />
      <AddCameraWizard open={wizardOpen} onClose={closeWizard} />
    </>
  )
}

export default App
