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
  /** Column can't be hidden or dragged (e.g. a trailing actions column). */
  locked?: boolean
  render: (row: T) => ReactNode
}
