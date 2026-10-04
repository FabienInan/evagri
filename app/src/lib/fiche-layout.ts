import type { FicheSection } from "@/types/champ"

export const UNASSIGNED = "__UNASSIGNED__"

/** Maps a container id (UNASSIGNED or a section id) to its ordered champ ids. */
export type Containers = Record<string, string[]>

export interface SectionMeta {
  id: string
  nom: string
}

export interface FicheLayoutState {
  containers: Containers
  sections: SectionMeta[]
}

export function newSectionId(): string {
  return `section_${Date.now()}_${Math.round(Math.random() * 1_000_000)}`
}

/** Rebuilds drag state from a persisted layout: drops stale/duplicated ids and pools champs not yet assigned. */
export function buildInitialLayout(
  champIds: string[],
  savedSections: FicheSection[]
): FicheLayoutState {
  const valid = new Set(champIds)
  const ordered = [...savedSections].sort((a, b) => a.ordre - b.ordre)

  const containers: Containers = {}
  const sections: SectionMeta[] = []
  const assigned = new Set<string>()

  for (const section of ordered) {
    const champs = section.champs.filter((id) => valid.has(id) && !assigned.has(id))
    champs.forEach((id) => assigned.add(id))
    containers[section.id] = champs
    sections.push({ id: section.id, nom: section.nom })
  }

  containers[UNASSIGNED] = champIds.filter((id) => !assigned.has(id))

  return { containers, sections }
}

export function findContainerOf(containers: Containers, id: string): string | null {
  if (id in containers) return id
  return Object.keys(containers).find((key) => containers[key].includes(id)) ?? null
}

/**
 * Moves a champ into another container at `index` (appended when index is omitted or out of range).
 * Returns the same reference when the move is a no-op so React can skip the re-render.
 */
export function moveBetweenContainers(
  containers: Containers,
  activeId: string,
  overId: string,
  insertBelow = false
): Containers {
  const from = findContainerOf(containers, activeId)
  const to = findContainerOf(containers, overId)
  if (!from || !to || from === to) return containers

  const target = containers[to]
  const overIndex = target.indexOf(overId)
  const index = overIndex === -1 ? target.length : overIndex + (insertBelow ? 1 : 0)

  return {
    ...containers,
    [from]: containers[from].filter((id) => id !== activeId),
    [to]: [...target.slice(0, index), activeId, ...target.slice(index)],
  }
}

/** Reorders a champ inside its own container. Returns the same reference when nothing changes. */
export function reorderWithinContainer(
  containers: Containers,
  activeId: string,
  overId: string
): Containers {
  const container = findContainerOf(containers, activeId)
  if (!container || container !== findContainerOf(containers, overId)) return containers

  const items = containers[container]
  const from = items.indexOf(activeId)
  const to = items.indexOf(overId)
  if (from === -1 || to === -1 || from === to) return containers

  const next = [...items]
  next.splice(from, 1)
  next.splice(to, 0, activeId)

  return { ...containers, [container]: next }
}

/** Deleting a section must not lose its champs: they go back to the unassigned pool. */
export function removeSection(
  state: FicheLayoutState,
  sectionId: string
): FicheLayoutState {
  const { [sectionId]: orphaned = [], ...rest } = state.containers

  return {
    containers: { ...rest, [UNASSIGNED]: [...(rest[UNASSIGNED] ?? []), ...orphaned] },
    sections: state.sections.filter((s) => s.id !== sectionId),
  }
}

export function reorderSections(sections: SectionMeta[], activeId: string, overId: string): SectionMeta[] {
  const from = sections.findIndex((s) => s.id === activeId)
  const to = sections.findIndex((s) => s.id === overId)
  if (from === -1 || to === -1 || from === to) return sections

  const next = [...sections]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)

  return next
}

/** Serialises the editor state into the persisted shape; the unassigned pool is intentionally dropped. */
export function toFicheSections(state: FicheLayoutState): FicheSection[] {
  return state.sections.map((section, index) => ({
    id: section.id,
    nom: section.nom.trim() || `Section ${index + 1}`,
    ordre: index,
    champs: state.containers[section.id] ?? [],
  }))
}
