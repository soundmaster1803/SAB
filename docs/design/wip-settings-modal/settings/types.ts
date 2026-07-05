/**
 * Shared types for the camera-settings modal (layer 2a).
 *
 * The apply-target model: the footer's segmented "Apply to" control (This camera /
 * All / Selected) decides where every control action goes. A control describes
 * itself as an ApplyAction — a per-camera single call plus, when the op is
 * batchable, its bulk equivalent. The modal routes it:
 *   target=one  → POST/PATCH the single per-camera endpoint
 *   target=all  → bulk(op, params, "all")  and show the per-camera report
 *   target=sel  → bulk(op, params, checkedIds) and show the report
 * Actions without a `bulk` block always hit the single per-camera endpoint (e.g.
 * device name/IP, focus-position — things that make no sense to batch).
 */

/** Apply target picked in the footer segmented control. */
export type ApplyTarget = 'one' | 'all' | 'sel'

/** One control action, routed to a single camera or a group by the modal. */
export interface ApplyAction {
  /** Per-camera endpoint hit when target=one, or for non-batchable actions. */
  single: {
    path: string
    method?: 'POST' | 'PATCH' | 'DELETE'
    body?: object
  }
  /** Bulk equivalent — omit when the op cannot sensibly apply to a group. */
  bulk?: {
    op: string
    params: object
    /** Short human label used to prefix per-camera errors in the report. */
    label: string
  }
}

/** Imperative hook the active tab registers so the footer Apply can commit it. */
export interface TabApi {
  /** Commit the tab's settings. `force` overrides the current footer target. */
  apply: (force?: ApplyTarget) => void
}

/** Props every settings tab receives from the modal. */
export interface TabProps {
  cam: import('../../../types/ws').CameraUIState
  /** Fire a control action live, routed by the current footer target. */
  dispatch: (action: ApplyAction) => void
  /** Register (or clear) this tab's footer-apply hook. */
  register: (api: TabApi | null) => void
}
