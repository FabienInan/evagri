import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type BreadcrumbItem = {
  label: string
  /** Lien vers le niveau parent. Le dernier élément (page courante) n'est jamais un lien. */
  href?: string
}

/** Fil d'ariane de navigation (ex. Dossiers › 25-12-001 › Panier A › 123456). */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'ariane" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1
          return (
            <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
              {item.href && !isCurrent ? (
                <Link
                  href={item.href}
                  className="cursor-pointer truncate font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isCurrent ? "page" : undefined} className={cn("truncate", isCurrent && "font-medium text-foreground")}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
