"use client"

/**
 * Reads brand colors from the CSS custom properties defined in globals.css,
 * so the palette has a single source of truth instead of being duplicated
 * as literal hex values here. Only call after mount (client components).
 */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function getThemeColors() {
  return {
    primary: cssVar("--primary"),
    accent: cssVar("--accent"),
    destructive: cssVar("--destructive"),
    primaryForeground: cssVar("--primary-foreground"),
    shadow: cssVar("--shadow-color"),
  }
}
