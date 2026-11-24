export const dynamic = "force-dynamic"

import { exigerZonePage } from "@/lib/session"
import { ImportExcelForm } from "@/components/import-excel-form"
import { ImportHistory } from "@/components/import-history"
import { ImportPdfForm } from "@/components/import-pdf-form"
import { listImports } from "@/server/actions/import"

export default async function ImportPage() {
  await exigerZonePage("configuration")
  const imports = await listImports()

  return (
    <div className="space-y-4 lg:space-y-6">
      <ImportExcelForm />
      <ImportPdfForm />
      <ImportHistory initialImports={imports} />
    </div>
  )
}
