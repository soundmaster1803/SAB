/**
 * AllPropsTab — searchable view over the full PTP3 catalog (776 properties).
 * Enum + Get/Set props render an editable select that writes via the generic
 * prop endpoint; others show read-only. This is the escape hatch for anything
 * not covered by the dedicated tabs.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ApplyAction, TabProps } from './types'
import { Note } from './parts'
import { Icon } from '../../../components/Icon'
import styles from './CameraSettingsModal.module.css'

interface CatalogProp {
  code: string
  name: string
  dataType?: string
  getSet?: string
  form?: string
  values?: Record<string, string>
}

let CACHE: CatalogProp[] | null = null

export function AllPropsTab({ cam, dispatch }: TabProps) {
  const id = cam.id
  const off = !cam.connected
  const [props, setProps] = useState<CatalogProp[]>(CACHE ?? [])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (CACHE) return
    fetch('/api/sony/catalog')
      .then((r) => r.json())
      .then((d: { properties: CatalogProp[] }) => { CACHE = d.properties ?? []; setProps(CACHE) })
      .catch(() => {})
  }, [])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return props.slice(0, 40)
    return props
      .filter((p) => p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s))
      .slice(0, 60)
  }, [props, q])

  function writeProp(code: number, value: number): ApplyAction {
    return {
      single: { path: `/api/cameras/${id}/prop`, body: { code, value, force: true } },
      bulk: { op: 'prop', params: { code, value, force: true }, label: `0x${code.toString(16)}` },
    }
  }

  return (
    <div className={styles.pane}>
      <div className={styles.selfake}>
        <Icon name="search" size={15} />
        <input
          className={styles.tin}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 776 properties — NR, zebra, timecode, stabilization, ND…"
          style={{ border: 0, background: 'transparent', padding: 0 }}
        />
      </div>
      {results.map((p) => {
        const code = parseInt(p.code, 16)
        const editable = p.form === 'enum' && p.values && p.getSet !== 'Get'
        return (
          <div key={p.code} className={styles.field}>
            <label className={styles.fieldLabel} title={p.code}>
              {p.name}
              <span className={styles.staticVal} style={{ marginLeft: 6, fontSize: 10 }}>{p.code}</span>
            </label>
            {editable ? (
              <select
                className={styles.select}
                defaultValue=""
                onChange={(e) => e.target.value !== '' && dispatch(writeProp(code, Number(e.target.value)))}
                disabled={off}
              >
                <option value="">— set —</option>
                {Object.entries(p.values!).map(([hex, label]) => (
                  <option key={hex} value={hex.startsWith('0x') ? parseInt(hex, 16) : Number(hex)}>{label}</option>
                ))}
              </select>
            ) : (
              <span className={styles.staticVal}>{p.getSet === 'Get' ? 'read-only' : (p.dataType ?? '—')}</span>
            )}
          </div>
        )
      })}
      {props.length === 0 && <Note>Loading catalog…</Note>}
      {props.length > 0 && results.length === 0 && <Note>No property matches “{q}”.</Note>}
    </div>
  )
}
