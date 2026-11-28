/**
 * Passe le champ « sousclasse_dominante » d'une organisation en LISTE (91 options du catalogue) et
 * canonicalise ses valeurs existantes (casse, ordre des lettres : « WF » → « FW »).
 *
 * Usage (depuis app/) :
 *   npx tsx scripts/migrate-sousclasse.ts <organisationId>            # rapport seul, rien n'est écrit
 *   npx tsx scripts/migrate-sousclasse.ts <organisationId> --appliquer # écrit, dans une transaction
 *
 * Idempotent : relancer sur une base déjà migrée ne change rien. Les valeurs hors règle sont conservées
 * telles quelles et listées dans le rapport.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { normalizeSousClasse, SOUS_CLASSE_OPTIONS } from "../src/lib/normalization/transforms"

const CODE = "sousclasse_dominante"

async function main() {
  const [organisationId, drapeau] = process.argv.slice(2)
  if (!organisationId) {
    console.error("Usage : npx tsx scripts/migrate-sousclasse.ts <organisationId> [--appliquer]")
    process.exit(2)
  }
  const appliquer = drapeau === "--appliquer"
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  try {
    const champ = await prisma.champ.findUnique({
      where: { organisationId_codeMachine: { organisationId, codeMachine: CODE } },
      select: { id: true, typeDonnees: true, optionsListe: true },
    })
    if (!champ) {
      console.log(`Champ « ${CODE} » absent de l'organisation ${organisationId} : rien à faire.`)
      return
    }

    const valeurs = await prisma.valeurChamp.findMany({
      where: { champId: champ.id, valeurTexte: { not: null } },
      select: { id: true, valeurTexte: true },
    })
    const aChanger: { id: string; de: string; vers: string }[] = []
    const horsRegle = new Map<string, number>()
    for (const v of valeurs) {
      const brut = v.valeurTexte ?? ""
      const canonique = normalizeSousClasse(brut)
      if (canonique === null) horsRegle.set(brut, (horsRegle.get(brut) ?? 0) + 1)
      else if (canonique !== brut) aChanger.push({ id: v.id, de: brut, vers: canonique })
    }

    const typeChange = champ.typeDonnees !== "LISTE"
    const optionsChangent = JSON.stringify(champ.optionsListe) !== JSON.stringify(SOUS_CLASSE_OPTIONS)
    console.log(`Organisation ${organisationId}, champ « ${CODE} »`)
    console.log(`  type : ${champ.typeDonnees} → LISTE${typeChange ? "" : " (déjà fait)"}`)
    console.log(`  options : ${optionsChangent ? `${SOUS_CLASSE_OPTIONS.length} options à écrire` : "déjà à jour"}`)
    console.log(`  valeurs : ${valeurs.length} au total, ${aChanger.length} à canonicaliser`)
    console.log(`  valeurs hors règle, conservées : ${[...horsRegle.entries()].reduce((n, [, c]) => n + c, 0)}`)
    for (const [valeur, n] of [...horsRegle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
      console.log(`    « ${valeur} » × ${n}`)
    }

    if (!appliquer) {
      console.log("\nRapport seul : relancer avec --appliquer pour écrire.")
      return
    }
    if (!typeChange && !optionsChangent && aChanger.length === 0) {
      console.log("\nDéjà migré : aucune écriture.")
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.champ.update({
        where: { id: champ.id },
        data: { typeDonnees: "LISTE", optionsListe: SOUS_CLASSE_OPTIONS },
      })
      for (const v of aChanger) {
        await tx.valeurChamp.update({ where: { id: v.id }, data: { valeurTexte: v.vers } })
      }
    })
    console.log(`\nÉcrit : champ en LISTE, ${aChanger.length} valeur(s) canonicalisée(s).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
