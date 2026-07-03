import fs from "node:fs/promises"
import path from "node:path"

export interface StoredFile {
  nomFichier: string
  cheminStockage: string
  cheminAbsolu: string
}

export async function saveActePDF(
  file: File,
  organisationId: string,
  transactionSourceId: string
): Promise<StoredFile> {
  const nomFichier = path.basename(file.name)
  const cheminStockage = `uploads/actes/${organisationId}/${transactionSourceId}/${nomFichier}`
  const dir = path.join(process.cwd(), "uploads", "actes", organisationId, transactionSourceId)

  await fs.mkdir(dir, { recursive: true })

  const cheminAbsolu = path.join(dir, nomFichier)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(cheminAbsolu, buffer)

  return { nomFichier, cheminStockage, cheminAbsolu }
}
