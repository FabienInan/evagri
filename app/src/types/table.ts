import type { ReactNode } from "react"

export type DataTableColumn<T> = {
  key: string
  label: string
  numeric?: boolean
  sortable?: boolean
  /** Column is shown by default when no user preference/auto-collapse has run. Defaults to true. */
  defaultVisible?: boolean
  minWidth?: number
  priority?: number
  /** Column can't be hidden (always shown). It can still be moved unless `immovable` is set. */
  locked?: boolean
  /** Fixed width in px. Overrides any saved width and hides the resize handle. Used for action columns. */
  fixedWidth?: number
  /** Column keeps its position (e.g. a trailing actions column): it can't be dragged, but others can be dropped before it. */
  immovable?: boolean
  render: (row: T) => ReactNode
}
