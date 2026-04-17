/**
 * App.tsx — root component shell.
 *
 * F1: WS connection started here. Real layout wired in F2.
 */
import { useEffect } from 'react'
import { useWsStore } from './stores/ws'

function App() {
  const connect = useWsStore((s) => s.connect)
  const status  = useWsStore((s) => s.status)

  useEffect(() => { connect() }, [connect])

  return (
    <div style={{ padding: '24px', color: 'var(--t2)', fontSize: '14px' }}>
      CineLink Bridge — WS: {status}
    </div>
  )
}

export default App
