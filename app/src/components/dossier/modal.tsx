"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Overlay maison : `ui/` n'expose pas de composant Dialog. Clic sur le fond ou la croix pour fermer. */
export function Modal({
  title,
  onClose,
  children,
  className,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Remplace la largeur par défaut (max-w-md) pour les formulaires plus riches. */
  className?: string
}) {
  // Échap ferme la fenêtre, comme la croix et un clic sur le fond.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("max-h-[90dvh] w-full max-w-md gap-3 overflow-y-auto p-5", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  )
}
