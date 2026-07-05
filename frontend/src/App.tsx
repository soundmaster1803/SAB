import { useCallback, useEffect, useState } from 'react'
import { useWsStore } from './stores/ws'
import { Header } from './components/Header'
import { CameraGrid } from './panels/cameras/CameraGrid'
import { BulkBar } from './panels/cameras/BulkBar'
import { AddCameraWizard } from './panels/cameras/AddCameraWizard'
import { AtemBar } from './panels/atem/AtemBar'
import { LogPanel } from './panels/logs/LogPanel'

function App() {
  const connect = useWsStore((s) => s.connect)
  useEffect(() => { connect() }, [connect])

  // Add Camera wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const openWizard  = useCallback(() => setWizardOpen(true), [])
  const closeWizard = useCallback(() => setWizardOpen(false), [])

  // Logs modal
  const [logsOpen, setLogsOpen] = useState(false)
  const openLogs  = useCallback(() => setLogsOpen(true), [])
  const closeLogs = useCallback(() => setLogsOpen(false), [])

  // Header global actions
  const recAll    = useCallback(() => fetch('/api/cameras/rec-all',    { method: 'POST' }), [])
  const stopAll   = useCallback(() => fetch('/api/cameras/stop-all',   { method: 'POST' }), [])
  const deleteAll = useCallback(() => fetch('/api/cameras/delete-all', { method: 'POST' }), [])

  return (
    <>
      <Header
        onAddCamera={openWizard}
        onRecAll={recAll}
        onStopAll={stopAll}
        onDeleteAll={deleteAll}
        onOpenLogs={openLogs}
      />

      <main style={{ padding: '16px' }}>
        <BulkBar />
        <CameraGrid />
      </main>

      <AtemBar />

      <AddCameraWizard open={wizardOpen} onClose={closeWizard} />
      <LogPanel        open={logsOpen}   onClose={closeLogs} />
    </>
  )
}

export default App
