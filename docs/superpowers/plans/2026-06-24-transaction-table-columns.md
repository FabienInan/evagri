# Transaction Table Responsive Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the transaction table show only the columns that fit in the available width by default, while letting users override and persist their choice.

**Architecture:** A pure helper decides which columns fit based on `minWidth` and `priority`. A small storage layer persists manual overrides in `localStorage`. A React hook wires the helper to a `ResizeObserver` on the table container. The `TransactionTable` component consumes the hook and adds a reset link to the existing column menu.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, `@testing-library/react`, `jsdom`.

## Global Constraints

- Client-side measurement only (`ResizeObserver` in the browser, no server measurement).
- `localStorage` key: `evagri:transaction-table:visible-columns`.
- Actions column is always visible (`requiredKeys: ["actions"]`).
- Manual override persists until the user clicks **Réinitialiser l'affichage auto**.
- SSR render uses existing `defaultVisible` values; client adjusts after mount.

---

### Task 1: Pure column-fitting algorithm

**Files:**
- Create: `app/src/lib/responsive-columns.ts`
- Test: `app/tests/lib/responsive-columns.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `ResponsiveColumn` type, `computeVisibleColumns(columns, containerWidth, requiredKeys)` returning `Set<string>`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/lib/responsive-columns.test.ts
import { describe, it, expect } from "vitest"
import { computeVisibleColumns } from "@/lib/responsive-columns"

const columns = [
  { key: "a", minWidth: 100, priority: 3 },
  { key: "b", minWidth: 80, priority: 2 },
  { key: "c", minWidth: 60, priority: 1 },
]

describe("computeVisibleColumns", () => {
  it("shows all columns when container is wide enough", () => {
    const result = computeVisibleColumns(columns, 300)
    expect([...result].sort()).toEqual(["a", "b", "c"])
  })

  it("hides lowest-priority columns when container is narrow", () => {
    const result = computeVisibleColumns(columns, 170)
    expect([...result]).toEqual(["a", "b"])
  })

  it("always includes required keys even if container is too narrow", () => {
    const result = computeVisibleColumns(columns, 50, ["b"])
    expect([...result]).toEqual(["b"])
  })

  it("skips unknown required keys", () => {
    const result = computeVisibleColumns(columns, 300, ["z"])
    expect([...result].sort()).toEqual(["a", "b", "c"])
  })

  it("returns empty set when nothing fits and nothing is required", () => {
    const result = computeVisibleColumns(columns, 0)
    expect([...result]).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app
npx vitest run tests/lib/responsive-columns.test.ts
```
Expected: FAIL with `computeVisibleColumns is not exported` or similar.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/responsive-columns.ts
export type ResponsiveColumn = {
  key: string
  minWidth: number
  priority: number
}

export function computeVisibleColumns(
  columns: ResponsiveColumn[],
  containerWidth: number,
  requiredKeys: string[] = []
): Set<string> {
  const sorted = [...columns].sort((a, b) => b.priority - a.priority)
  let used = 0
  const visible = new Set<string>()

  for (const key of requiredKeys) {
    const col = columns.find((c) => c.key === key)
    if (col) {
      visible.add(key)
      used += col.minWidth
    }
  }

  for (const col of sorted) {
    if (visible.has(col.key)) continue
    if (used + col.minWidth <= containerWidth) {
      visible.add(col.key)
      used += col.minWidth
    } else {
      break
    }
  }

  return visible
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/lib/responsive-columns.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add app/src/lib/responsive-columns.ts app/tests/lib/responsive-columns.test.ts
git commit -m "$(cat <<'EOF'
feat(columns): add responsive column-fitting algorithm

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: localStorage persistence helpers

**Files:**
- Modify: `app/src/lib/responsive-columns.ts`
- Test: `app/tests/lib/responsive-columns.test.ts`

**Interfaces:**
- Consumes: `STORAGE_KEY` constant
- Produces: `loadColumnPreference()`, `saveColumnPreference(keys)`, `clearColumnPreference()`

- [ ] **Step 1: Write the failing test**

Append to `app/tests/lib/responsive-columns.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  loadColumnPreference,
  saveColumnPreference,
  clearColumnPreference,
} from "@/lib/responsive-columns"

describe("column preference storage", () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns null when no preference is saved", () => {
    expect(loadColumnPreference()).toBeNull()
  })

  it("loads a saved preference", () => {
    storage["evagri:transaction-table:visible-columns"] = JSON.stringify(["a", "c"])
    expect(loadColumnPreference()).toEqual(["a", "c"])
  })

  it("ignores corrupted stored value", () => {
    storage["evagri:transaction-table:visible-columns"] = "not-json"
    expect(loadColumnPreference()).toBeNull()
  })

  it("ignores non-array stored value", () => {
    storage["evagri:transaction-table:visible-columns"] = JSON.stringify({ a: true })
    expect(loadColumnPreference()).toBeNull()
  })

  it("saves a preference", () => {
    saveColumnPreference(["b", "c"])
    expect(storage["evagri:transaction-table:visible-columns"]).toBe(JSON.stringify(["b", "c"]))
  })

  it("clears a preference", () => {
    storage["evagri:transaction-table:visible-columns"] = JSON.stringify(["a"])
    clearColumnPreference()
    expect(storage["evagri:transaction-table:visible-columns"]).toBeUndefined()
  })

  it("returns null on server where localStorage is missing", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(loadColumnPreference()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/fabien/Documents/projets/Evagri/app
npx vitest run tests/lib/responsive-columns.test.ts
```
Expected: FAIL because the functions are not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `app/src/lib/responsive-columns.ts`:

```ts
const STORAGE_KEY = "evagri:transaction-table:visible-columns"

export function loadColumnPreference(): string[] | null {
  if (typeof window === "undefined" || !window.localStorage) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function saveColumnPreference(keys: string[]) {
  if (typeof window === "undefined" || !window.localStorage) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

export function clearColumnPreference() {
  if (typeof window === "undefined" || !window.localStorage) return
  window.localStorage.removeItem(STORAGE_KEY)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/responsive-columns.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add app/src/lib/responsive-columns.ts app/tests/lib/responsive-columns.test.ts
git commit -m "$(cat <<'EOF'
feat(columns): persist visible column preference in localStorage

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: React hook with ResizeObserver

**Files:**
- Create: `app/src/hooks/use-responsive-columns.ts`
- Modify: `app/package.json` (add dev dependencies)
- Test: `app/tests/hooks/use-responsive-columns.test.tsx`

**Interfaces:**
- Consumes: `computeVisibleColumns`, `loadColumnPreference`, `saveColumnPreference`, `clearColumnPreference` from `@/lib/responsive-columns`
- Produces: `useResponsiveColumns(columns, initialVisible, requiredKeys)` returning `{ containerRef, visibleColumns, toggleColumn, resetColumns, hasUserOverride }`

- [ ] **Step 1: Add test dependencies**

```bash
cd /Users/fabien/Documents/projets/Evagri/app
npm install -D jsdom @testing-library/react
```

- [ ] **Step 2: Write the failing test**

Create `app/tests/hooks/use-responsive-columns.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import { clearColumnPreference } from "@/lib/responsive-columns"

const columns = [
  { key: "a", minWidth: 100, priority: 3 },
  { key: "b", minWidth: 80, priority: 2 },
  { key: "c", minWidth: 60, priority: 1 },
]

class MockResizeObserver {
  callback: ResizeObserverCallback
  target?: Element

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.target = target
  }

  disconnect() {
    this.target = undefined
  }

  trigger(width: number) {
    if (!this.target) return
    this.callback(
      [
        {
          target: this.target,
          contentRect: { width } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this
    )
  }
}

describe("useResponsiveColumns", () => {
  let observer: MockResizeObserver | null = null

  beforeEach(() => {
    clearColumnPreference()
    vi.stubGlobal(
      "ResizeObserver",
      class extends MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          super(callback)
          observer = this
        }
      }
    )
  })

  afterEach(() => {
    observer = null
    vi.unstubAllGlobals()
  })

  it("calculates visible columns from container width", () => {
    const initialVisible = new Set<string>(["a"])
    const { result } = renderHook(() =>
      useResponsiveColumns(columns, initialVisible, ["a"])
    )

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 180,
      } as HTMLDivElement
      observer?.trigger(180)
    })

    expect([...result.current.visibleColumns].sort()).toEqual(["a", "b"])
  })

  it("persists manual toggle and stops auto calculation", () => {
    const initialVisible = new Set<string>(["a"])
    const { result } = renderHook(() =>
      useResponsiveColumns(columns, initialVisible, ["a"])
    )

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 180,
      } as HTMLDivElement
      observer?.trigger(180)
    })

    act(() => {
      result.current.toggleColumn("c")
    })

    expect(result.current.hasUserOverride).toBe(true)
    expect([...result.current.visibleColumns].sort()).toEqual(["a", "c"])
    expect(window.localStorage.getItem("evagri:transaction-table:visible-columns")).toBe(
      JSON.stringify(["a", "c"])
    )

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 300,
      } as HTMLDivElement
      observer?.trigger(300)
    })

    expect([...result.current.visibleColumns].sort()).toEqual(["a", "c"])
  })

  it("reset clears preference and resumes auto calculation", () => {
    const initialVisible = new Set<string>(["a"])
    const { result } = renderHook(() =>
      useResponsiveColumns(columns, initialVisible, ["a"])
    )

    act(() => {
      result.current.toggleColumn("c")
    })

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 180,
      } as HTMLDivElement
      observer?.trigger(180)
      result.current.resetColumns()
    })

    expect(result.current.hasUserOverride).toBe(false)
    expect(window.localStorage.getItem("evagri:transaction-table:visible-columns")).toBeNull()
    expect([...result.current.visibleColumns].sort()).toEqual(["a", "b"])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /Users/fabien/Documents/projets/Evagri/app
npx vitest run tests/hooks/use-responsive-columns.test.tsx
```
Expected: FAIL with `useResponsiveColumns is not exported` or `ResizeObserver is not defined`.

- [ ] **Step 4: Write minimal implementation**

Create `app/src/hooks/use-responsive-columns.ts`:

```ts
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  computeVisibleColumns,
  loadColumnPreference,
  saveColumnPreference,
  clearColumnPreference,
  type ResponsiveColumn,
} from "@/lib/responsive-columns"

export function useResponsiveColumns(
  columns: ResponsiveColumn[],
  initialVisible: Set<string>,
  requiredKeys: string[] = []
) {
  const containerRef = useRef<HTMLDivElement>(null)

  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return initialVisible
    const saved = loadColumnPreference()
    return saved ? new Set(saved) : initialVisible
  })

  const [hasUserOverride, setHasUserOverride] = useState(() => {
    if (typeof window === "undefined") return false
    return loadColumnPreference() !== null
  })

  const calculate = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const width = el.clientWidth
    if (width <= 0) return
    setVisibleColumnsState(computeVisibleColumns(columns, width, requiredKeys))
  }, [columns, requiredKeys])

  useEffect(() => {
    if (hasUserOverride) return
    calculate()
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          calculate()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [calculate, hasUserOverride])

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumnsState((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveColumnPreference([...next])
      return next
    })
    setHasUserOverride(true)
  }, [])

  const resetColumns = useCallback(() => {
    clearColumnPreference()
    setHasUserOverride(false)
    calculate()
  }, [calculate])

  return {
    containerRef,
    visibleColumns,
    toggleColumn,
    resetColumns,
    hasUserOverride,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/hooks/use-responsive-columns.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add app/src/hooks/use-responsive-columns.ts app/tests/hooks/use-responsive-columns.test.tsx app/package.json app/package-lock.json
git commit -m "$(cat <<'EOF'
feat(columns): useResponsiveColumns hook with ResizeObserver

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire hook into TransactionTable

**Files:**
- Modify: `app/src/components/transaction-table.tsx`

**Interfaces:**
- Consumes: `useResponsiveColumns` from `@/hooks/use-responsive-columns`
- Produces: responsive default visible columns and a reset action in the column menu

- [ ] **Step 1: Update COLUMNS with widths and priorities**

In `app/src/components/transaction-table.tsx`, replace the `COLUMNS` array with:

```ts
const COLUMNS = [
  { key: "numeroInscription", label: "Numéro d'acte", numeric: false, sortable: true, defaultVisible: true, minWidth: 140, priority: 9 },
  { key: "typeTransaction", label: "Type", numeric: false, sortable: false, defaultVisible: true, minWidth: 100, priority: 2 },
  { key: "dateVente", label: "Date", numeric: false, sortable: true, defaultVisible: true, minWidth: 110, priority: 8 },
  { key: "mrc", label: "MRC", numeric: false, sortable: true, defaultVisible: true, minWidth: 120, priority: 4 },
  { key: "municipalite", label: "Municipalité", numeric: false, sortable: true, defaultVisible: false, minWidth: 150, priority: 1 },
  { key: "superficieTotaleHectare", label: "Superficie (ha)", numeric: true, sortable: true, defaultVisible: true, minWidth: 130, priority: 5 },
  { key: "prixVente", label: "Prix à l'acte", numeric: true, sortable: true, defaultVisible: true, minWidth: 140, priority: 7 },
  { key: "tauxGlobal", label: "Taux global ($/ha)", numeric: true, sortable: false, defaultVisible: true, minWidth: 140, priority: 6 },
  { key: "statut", label: "Statut", numeric: false, sortable: false, defaultVisible: true, minWidth: 110, priority: 3 },
  { key: "actions", label: "Actions", numeric: false, sortable: false, defaultVisible: true, minWidth: 80, priority: 10 },
]
```

- [ ] **Step 2: Replace local state with the hook**

Inside `TransactionTable`, replace:

```ts
const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
  () => new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
)
const [showColumnMenu, setShowColumnMenu] = useState(false)
const visible = useMemo(() => COLUMNS.filter((c) => visibleColumns.has(c.key)), [visibleColumns])

function toggleColumn(key: string) {
  setVisibleColumns((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
}
```

with:

```ts
const initialVisible = useMemo(
  () => new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)),
  []
)
const columnMeta = useMemo(
  () => COLUMNS.map((c) => ({ key: c.key, minWidth: c.minWidth, priority: c.priority })),
  []
)
const {
  containerRef,
  visibleColumns,
  toggleColumn,
  resetColumns,
  hasUserOverride,
} = useResponsiveColumns(columnMeta, initialVisible, ["actions"])

const [showColumnMenu, setShowColumnMenu] = useState(false)
const visible = useMemo(() => COLUMNS.filter((c) => visibleColumns.has(c.key)), [visibleColumns])
```

- [ ] **Step 3: Attach the ref to the scrollable container**

Replace:

```tsx
<div className="overflow-auto">
```

with:

```tsx
<div className="overflow-auto" ref={containerRef}>
```

- [ ] **Step 4: Add reset link to the column menu**

Replace the column menu block in `TransactionTable`:

```tsx
{showColumnMenu && (
  <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-card p-2 shadow-md">
    {COLUMNS.filter((c) => c.key !== "actions").map((col) => (
      <label
        key={col.key}
        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
      >
        <input
          type="checkbox"
          checked={visibleColumns.has(col.key)}
          onChange={() => toggleColumn(col.key)}
        />
        {col.label}
      </label>
    ))}
  </div>
)}
```

with:

```tsx
{showColumnMenu && (
  <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card p-2 shadow-md">
    {COLUMNS.filter((c) => c.key !== "actions").map((col) => (
      <label
        key={col.key}
        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
      >
        <input
          type="checkbox"
          checked={visibleColumns.has(col.key)}
          onChange={() => toggleColumn(col.key)}
        />
        {col.label}
      </label>
    ))}
    {hasUserOverride && (
      <>
        <div className="my-1 border-t border-border" />
        <button
          className="w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            resetColumns()
            setShowColumnMenu(false)
          }}
        >
          Réinitialiser l'affichage auto
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 5: Remove unused import**

Remove `useState` from the React import only if it is no longer used elsewhere. `useState` is still used for `showColumnMenu`, so keep it. Remove the unused `useMemo`? No, it is still used. Add `useResponsiveColumns` import:

```ts
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
```

- [ ] **Step 6: Run type check and tests**

```bash
cd /Users/fabien/Documents/projets/Evagri/app
npx tsc --noEmit
npx vitest run
```
Expected: PASS.

- [ ] **Step 7: Manual verification**

Open the application at `/transactions` and verify:

1. With the filter panel open, the table does not scroll horizontally by default.
2. With the filter panel closed, more columns appear automatically.
3. Resizing the browser window updates the default visible columns.
4. Opening the **Colonnes** menu, unchecking a column, then reloading the page keeps the same selection.
5. Clicking **Réinitialiser l'affichage auto** restores the responsive default.

- [ ] **Step 8: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add app/src/components/transaction-table.tsx
git commit -m "$(cat <<'EOF'
feat(columns): responsive default columns in transaction table

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

- **Spec coverage:**
  - Responsive default calculation: Task 1 (algorithm) + Task 3 (hook).
  - Manual override persistence: Task 2 (storage) + Task 3 (hook).
  - Reset action: Task 3 (`resetColumns`) + Task 4 (UI).
  - ResizeObserver: Task 3.
  - Actions always visible: `requiredKeys: ["actions"]` in Task 4.
  - SSR fallback: `initialVisible` passed from `defaultVisible` in Task 4.
- **Placeholder scan:** No `TBD`, `TODO`, or vague instructions. Every step includes code or exact commands.
- **Type consistency:** `ResponsiveColumn` is used in Task 1 and Task 3. Hook signature uses `Set<string>` consistently. Storage functions use `string[]`.
