import {
  SlidersHorizontal,
  Calendar,
  List,
  Search,
  ToggleLeft,
  Hash,
  Type,
  CheckSquare,
  MapPin,
  DollarSign,
  Ruler,
  User,
  Home,
  FileDigit,
  Percent,
  TrendingUp,
  Scale,
  Leaf,
  Sprout,
  Trees,
  Building2,
  Droplets,
  Mountain,
  Route,
  Target,
  Wrench,
  Hammer,
  FlaskConical,
  Clock,
  FileText,
  Banknote,
  Navigation,
  Milestone,
  Globe2,
  PieChart,
  Gavel,
  MessageSquare,
  Layers,
  Package,
  Activity,
  LucideIcon,
} from "lucide-react"

type Champ = {
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
}

const FILTER_TYPE_ICONS: Record<string, LucideIcon> = {
  PLAGE_NUMERIQUE: SlidersHorizontal,
  PLAGE_DATE: Calendar,
  LISTE: List,
  MULTI_SELECT: List,
  RECHERCHE_TEXTE: Search,
  BOOLEEN: ToggleLeft,
}

const DATA_TYPE_ICONS: Record<string, LucideIcon> = {
  DECIMAL: Hash,
  ENTIER: Hash,
  TEXTE: Type,
  LISTE: List,
  DATE: Calendar,
  BOOLEAN: CheckSquare,
  COORDONNEES: MapPin,
  DEVISE: DollarSign,
  SURFACE: Ruler,
}

const FIELD_CODE_ICONS: Record<string, LucideIcon> = {
  statut: Activity,
  numeroInscription: FileDigit,
  dateVente: Calendar,
  vendeur: User,
  acheteur: User,
  prixVente: DollarSign,
  mrc: Home,
  municipalite: Home,
  adresse: Home,
  superficieTotaleHectare: Ruler,
  lotsCadastraux: MapPin,
  typeTransaction: List,
  topographie: Mountain,
  superficie_boise_ha: Trees,
  superficie_cultive_ha: Sprout,
  prix_de_vente_redress_au_temps_: TrendingUp,
  zone_agricole_cptaq: Target,
  feuillusrsineux: Trees,
  proportion_feuillus: PieChart,
  proporition_rsineux: Trees,
  densit_plantation: Leaf,
  zones_humides_ha: Droplets,
  zones_humides_types: Droplets,
  btiments_agricoles: Building2,
  valeur_contributive_btiments_agricoles_: DollarSign,
  source_valeur_constributive_btiments_agricoles: FileText,
  quipements: Wrench,
  superficie_acricole_ha: Leaf,
  nombre_dentailles: Hash,
  contingent_acricole_livres: Scale,
  observations: MessageSquare,
  dcisions_cptaq: Gavel,
  taux_unitaire_global_ha: Percent,
  entaille: DollarSign,
  classe_de_sol_dominante: Layers,
  sousclasse_dominante: Layers,
  source_superficie_cultive: FileText,
  superficie_draine_ha: Droplets,
  source_superficie_draine: FileText,
  type_de_sol: Sprout,
  type_de_culture: Leaf,
  superficie_plantation: Leaf,
  superficie_terrain_rsidentiel_m: Home,
  droit_acquis: FileText,
  maisons: Home,
  valeur_contributive_maisons_terrain_: DollarSign,
  source_valeur_constributive_maisons_terrain_: FileText,
  autres_inclusions: Package,
  valeur_autres_inclusions_: DollarSign,
}

const FIELD_NAME_ICONS: { test: (code: string, label: string) => boolean; icon: LucideIcon }[] = [
  { test: (_, label) => /numéro|numero|inscription|n[°o]\s*d|enregistrement|identifiant|id$/.test(label), icon: FileDigit },
  { test: (code, label) => /date|vente|année|annee|annuel/.test(label) || /date|vente|annee/.test(code), icon: Calendar },
  { test: (_, label) => /vendeur|acheteur|acheteur|propriétaire|proprietaire|contact|client|témoin|temoin|notaire|intervenant/.test(label), icon: User },
  { test: (_, label) => /lot|cadastre|cadastral|parcelle|terrain|emplacement/.test(label), icon: MapPin },
  { test: (_, label) => /prix|coût|cout|montant|valeur|devise|revenu|prix\/|dollar|canadien/.test(label), icon: DollarSign },
  { test: (_, label) => /mrc|municipalité|municipalite|ville|adresse|région|region|localisation|secteur|quartier/.test(label), icon: Home },
  { test: (_, label) => /superficie|surface|hectare|acre|mètre|metre|dimension|frontage|profondeur/.test(label), icon: Ruler },
  { test: (_, label) => /type|typologie|catégorie|categorie|classe|classification|nature/.test(label), icon: List },
  { test: (_, label) => /taux|taux\s|ratio|pourcentage|yield|percent/.test(label), icon: Percent },
  { test: (_, label) => /rendement|performance|croissance|évolution|evolution|tendance|indice/.test(label), icon: TrendingUp },
  { test: (_, label) => /indicateur|calcul|formule|métrique|metrique|estimateur|coefficient/.test(label), icon: Scale },
  { test: (_, label) => /densité|densite|plantation|semis|culture|récolte|recolte|feuillage|végétation|vegetation|culture/.test(label), icon: Leaf },
  { test: (_, label) => /bois|forêt|foret|boisée|boisee|érablière|erabliere|arbres|arbres/.test(label), icon: Trees },
  { test: (_, label) => /bâtiment|batiment|construction|bâtisse|batisse|grange|étable|etable|hangar|serre/.test(label), icon: Building2 },
  { test: (_, label) => /eau|irrigation|drain|drainage|humidité|humidite|nappe|puits/.test(label), icon: Droplets },
  { test: (_, label) => /topographie|topo|relief|pente|contour|élévation|elevation|montagne/.test(label), icon: Mountain },
  { test: (_, label) => /accès|acces|route|chemin|voie|entrée|entree|passage/.test(label), icon: Route },
  { test: (_, label) => /vocation|destination|usage|utilisation|affectation|potential|potentiel/.test(label), icon: Target },
  { test: (_, label) => /amélioration|amelioration|travaux|rénovation|renovation|entretien|maintenance/.test(label), icon: Wrench },
  { test: (_, label) => /clôture|cloture|limite|bornage|délimitation|delimitation/.test(label), icon: Hammer },
  { test: (_, label) => /engrais|fertilité|fertilite|ph|chimie|analyse|sol/.test(label), icon: FlaskConical },
  { test: (_, label) => /âge|age|ancienneté|anciennete|durée|duree|historique/.test(label), icon: Clock },
  { test: (_, label) => /bail|location|tenure|droit|titre|acte|contrat|convention/.test(label), icon: FileText },
  { test: (_, label) => /revenu|rentabilité|rentabilite|profit|marge|bénéfice|benefice/.test(label), icon: Banknote },
  { test: (_, label) => /distance|proximité|proximite|éloignement|eloignement|kilomètre|kilometre/.test(label), icon: Navigation },
  { test: (_, label) => /environnement|voisinage|alentour|entourage|contexte/.test(label), icon: Globe2 },
  { test: (_, label) => /étape|etape|jalon|phase|avancement|progrès|progres/.test(label), icon: Milestone },
  { test: (_, label) => /jeune|nouveau|plant|reboisement|semence|germe/.test(label), icon: Sprout },
]

export function getFilterIcon(
  typeFiltre?: string | null,
  champ?: Champ | null,
  codeMachine?: string | null
): LucideIcon {
  const code = codeMachine ?? champ?.codeMachine ?? ""
  const label = champ?.nomAffichage?.toLowerCase() ?? ""

  if (FIELD_CODE_ICONS[code]) {
    return FIELD_CODE_ICONS[code]
  }

  for (const mapping of FIELD_NAME_ICONS) {
    if (mapping.test(code.toLowerCase(), label)) {
      return mapping.icon
    }
  }

  if (typeFiltre && FILTER_TYPE_ICONS[typeFiltre]) {
    return FILTER_TYPE_ICONS[typeFiltre]
  }

  const typeDonnees = champ?.typeDonnees
  if (typeDonnees && DATA_TYPE_ICONS[typeDonnees]) {
    return DATA_TYPE_ICONS[typeDonnees]
  }

  return Search
}

export function getFilterIconColor(typeFiltre?: string | null): string {
  switch (typeFiltre) {
    case "PLAGE_NUMERIQUE":
      return "bg-primary/15 text-primary dark:bg-primary/25"
    case "PLAGE_DATE":
      return "bg-accent/20 text-accent-foreground dark:bg-accent/25"
    case "LISTE":
    case "MULTI_SELECT":
      return "bg-secondary text-secondary-foreground dark:bg-secondary/80"
    case "BOOLEEN":
      return "bg-primary/10 text-primary dark:bg-primary/20"
    case "RECHERCHE_TEXTE":
    default:
      return "bg-muted text-muted-foreground dark:bg-muted/80"
  }
}
