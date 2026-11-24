export const dynamic = "force-dynamic"

import { exigerZonePage } from "@/lib/session"
import { listJournalByOrganisation } from "@/repositories/journal.repository"

function formaterDiff(diff: unknown): string {
  if (diff === null || diff === undefined) return "—"
  if (typeof diff === "object" && Object.keys(diff as object).length === 0) return "—"
  return JSON.stringify(diff)
}

export default async function JournalAuditPage() {
  const utilisateur = await exigerZonePage("administration")
  const entrees = await listJournalByOrganisation(utilisateur.organisationId)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Journal d&apos;audit</h1>
        <p className="text-sm text-muted-foreground">
          Les {entrees.length} dernières modifications de l&apos;organisation, de la plus récente à la plus ancienne.
        </p>
      </div>

      {entrees.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Date</th>
                <th className="p-2 font-medium">Utilisateur</th>
                <th className="p-2 font-medium">Action</th>
                <th className="p-2 font-medium">Table</th>
                <th className="p-2 font-medium">Enregistrement</th>
                <th className="p-2 font-medium">Détail</th>
              </tr>
            </thead>
            <tbody>
              {entrees.map((e) => (
                <tr key={e.id} className="border-b border-border align-top">
                  <td className="whitespace-nowrap p-2">
                    {e.createdAt.toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "medium" })}
                  </td>
                  <td className="p-2">{e.utilisateurEmail ?? "Système"}</td>
                  <td className="p-2 font-mono text-xs">{e.action}</td>
                  <td className="p-2">{e.tableCible}</td>
                  <td className="p-2 font-mono text-xs">{e.enregistrementId ?? "—"}</td>
                  <td className="p-2 font-mono text-xs break-all">{formaterDiff(e.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
