// Pure module (no server imports): shared by server code and client components.

export const ROLES = ["ADMIN", "EVALUATEUR", "DEVELOPPEUR"] as const
export type Role = (typeof ROLES)[number]

/**
 * Zones of the application, each grouping pages and server actions:
 * - evaluation: transactions, fiches, dossiers, paniers
 * - configuration: import, champs enrichissables, filtres de recherche, mise en page des fiches
 * - administration: gestion des utilisateurs
 */
export const ZONES = ["evaluation", "configuration", "administration"] as const
export type Zone = (typeof ZONES)[number]

export const ZONES_PAR_ROLE: Record<Role, readonly Zone[]> = {
  ADMIN: ["evaluation", "configuration", "administration"],
  EVALUATEUR: ["evaluation"],
  DEVELOPPEUR: ["configuration"],
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

export function peutAcceder(role: Role, zone: Zone): boolean {
  return ZONES_PAR_ROLE[role].includes(zone)
}

/** Where a user lands when they open a page outside their zones. */
export function pageAccueil(role: Role): string {
  return peutAcceder(role, "evaluation") ? "/transactions" : "/admin/import"
}
