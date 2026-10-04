"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Carte de section de la fiche : titre souligné d'un filet vert (accent de la charte), en-tête
 *  séparé du contenu. Les paddings du Card sont neutralisés ici pour un rendu homogène. */
export function SectionCard({
  title,
  description,
  children,
  className,
  headerClassName,
  contentClassName,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn("gap-3 py-0 pb-0", className)}>
      <CardHeader className={cn("border-b border-border/60 px-5 pt-3.5 pb-3", headerClassName)}>
        <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <span aria-hidden className="h-4 w-1 shrink-0 rounded-full bg-primary" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={cn("px-5 py-4", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
