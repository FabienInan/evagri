-- DropIndex
DROP INDEX "transaction_source_id_organisation_numero_inscription_date__key";

-- AlterTable
ALTER TABLE "transaction_source" DROP COLUMN "latitude",
DROP COLUMN "longitude";

-- CreateIndex
CREATE INDEX "transaction_source_id_organisation_numero_inscription_date__idx" ON "transaction_source"("id_organisation", "numero_inscription", "date_vente");

