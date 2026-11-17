"use client"

import { Marker, Tooltip } from "react-leaflet"
import { tauxPinIcon } from "@/components/transaction-map/cluster-layer"

/** Jaune du pin du dossier en cours, distinct des couleurs de taux et de la sélection. */
const DOSSIER_PIN_COLOR = "#facc15"

export type DossierLocalisation = { numeroDossier: string; latitude: number; longitude: number }

/** Pin du dossier en cours : hors du regroupement des transactions, donc toujours visible au-dessus. */
export function DossierPin({ localisation }: { localisation: DossierLocalisation }) {
  return (
    <Marker
      position={[localisation.latitude, localisation.longitude]}
      icon={tauxPinIcon(DOSSIER_PIN_COLOR)}
      zIndexOffset={1000}
    >
      <Tooltip direction="top" offset={[0, -36]}>
        Dossier {localisation.numeroDossier}
      </Tooltip>
    </Marker>
  )
}
