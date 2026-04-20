/**
 * SearchIcon — inline magnifier-glass SVG.
 *
 * Uses `currentColor` so it inherits the parent element's `color` —
 * this keeps iconography theme-aware without prop drilling.
 */
interface SearchIconProps {
  size?: number
  strokeWidth?: number
  title?: string
}

export function SearchIcon({ size = 14, strokeWidth = 2, title }: SearchIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
