/**
 * App.tsx — root layout shell.
 *
 * F2: Header + main content area + LogPanel + TallyBar.
 * Camera grid (F3), wizard (F5), debug modal (F4) mount inside main.
 */
import { useEffect } from 'react'
import { useWsStore } from './stores/ws'
import { Header } from './components/Header'
import { LogPanel } from './panels/logs/LogPanel'
import { TallyBar } from './panels/TallyBar'

function App() {
  const connect = useWsStore((s) => s.connect)

  useEffect(() => { connect() }, [connect])

  return (
    <>
      <Header />

      <main style={{ padding: '16px' }}>
        {/* CameraGrid mounts here in F3 */}
      </main>

      <LogPanel />
      <TallyBar />
    </>
  )
}

export default App
