import { ImportExcelForm } from "@/components/import-excel-form"
import { ImportHistory } from "@/components/import-history"
import { listImports } from "@/server/actions/import"

export default async function ImportPage() {
  const imports = await listImports()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Gestion des imports</h1>
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Importer un fichier Excel EVAGRI</h2>
          <ImportExcelForm />
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-4">Historique des importations</h2>
          <ImportHistory initialImports={imports} />
        </section>
      </div>
    </main>
  )
}
