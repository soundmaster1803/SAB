import { useCallback, useEffect, useState } from 'react'
import { useWsStore } from './stores/ws'
import { RoomBar } from './components/RoomBar'
import { CameraGrid } from './panels/cameras/CameraGrid'
import { AddCameraWizard } from './panels/cameras/AddCameraWizard'
import { AtemBar } from './panels/atem/AtemBar'
import { LogPanel } from './panels/logs/LogPanel'
import { DemoDriver } from './panels/demo/DemoDriver'
import { PresetsModal } from './panels/presets/PresetsModal'

function App() {
  const connect = useWsStore((s) => s.connect)
  useEffect(() => { connect() }, [connect])

  const [wizardOpen, setWizardOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)

  const recAll = useCallback(() => { fetch('/api/cameras/rec-all', { method: 'POST' }) }, [])
  const stopAll = useCallback(() => { fetch('/api/cameras/stop-all', { method: 'POST' }) }, [])
  const deleteAll = useCallback(() => { fetch('/api/cameras/delete-all', { method: 'POST' }) }, [])

  return (
    <>
      <DemoDriver />
      <RoomBar
        onAddCamera={() => setWizardOpen(true)}
        onRecAll={recAll}
        onStopAll={stopAll}
        onDeleteAll={deleteAll}
        onOpenLogs={() => setLogsOpen(true)}
        onOpenPresets={() => setPresetsOpen(true)}
        onPushFormat={() => setPresetsOpen(true)}
      />

      <main style={{ padding: '16px' }}>
        <CameraGrid />
      </main>

      <AtemBar />

      <AddCameraWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      <LogPanel open={logsOpen} onClose={() => setLogsOpen(false)} />
      <PresetsModal open={presetsOpen} onClose={() => setPresetsOpen(false)} />
    </>
  )
}

export default App
