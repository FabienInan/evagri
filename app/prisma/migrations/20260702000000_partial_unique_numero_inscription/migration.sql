-- Drop the existing unique index that disallows null numero_inscription
DROP INDEX IF EXISTS "transaction_source_id_organisation_numero_inscription_date_vente_key";

-- Create a partial unique index that only applies when numero_inscription is not null
CREATE UNIQUE INDEX "transaction_source_org_numero_date_key"
ON "transaction_source"("id_organisation", "numero_inscription", "date_vente")
WHERE "numero_inscription" IS NOT NULL;
