/**
 * App.tsx — root layout shell.
 *
 * F2: Header + main content area + LogPanel + TallyBar.
 * F3: CameraGrid mounted in main.
 * F4: DebugModal — full-screen overlay, triggered from CameraCard gear button.
 * F5: AddCameraWizard (pending).
 */
import { useCallback, useEffect, useState } from 'react'
import { useWsStore } from './stores/ws'
import { Header } from './components/Header'
import { CameraGrid } from './panels/cameras/CameraGrid'
import { DebugModal } from './panels/cameras/DebugModal'
import { LogPanel } from './panels/logs/LogPanel'
import { TallyBar } from './panels/TallyBar'

function App() {
  const connect = useWsStore((s) => s.connect)
  useEffect(() => { connect() }, [connect])

  const [debugCamId, setDebugCamId] = useState<string | null>(null)
  const openDebug  = useCallback((id: string) => setDebugCamId(id), [])
  const closeDebug = useCallback(() => setDebugCamId(null), [])

  return (
    <>
      <Header />

      <main style={{ padding: '16px' }}>
        <CameraGrid onDebug={openDebug} />
      </main>

      <LogPanel />
      <TallyBar />

      <DebugModal camId={debugCamId} onClose={closeDebug} />
    </>
  )
}

export default App
