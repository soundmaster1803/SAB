import styles from './Dot.module.css'

interface DotProps {
  on?: boolean
  title?: string
}

export function Dot({ on, title }: DotProps) {
  return (
    <div
      className={`${styles.dot} ${on ? styles.on : ''}`}
      title={title}
    />
  )
}
