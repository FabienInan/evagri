-- AlterTable
ALTER TABLE "filtre_recherche" ADD COLUMN "code_machine" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "filtre_recherche_id_organisation_code_machine_key" ON "filtre_recherche"("id_organisation", "code_machine");

-- Seed default virtual "Statut d'analyse" filter
INSERT INTO "filtre_recherche" (
    "id",
    "id_organisation",
    "id_champ_enrichissable",
    "code_machine",
    "nom_filtre",
    "type_filtre",
    "operateurs_disponibles",
    "ordre_affichage",
    "est_actif",
    "applicable_a_types"
)
SELECT
    '00000000-0000-0000-0000-000000000002',
    id,
    NULL,
    'statut',
    'Statut d''analyse',
    'LISTE',
    '["="]',
    1,
    true,
    '[]'
FROM "organisation"
WHERE NOT EXISTS (
    SELECT 1 FROM "filtre_recherche" WHERE "code_machine" = 'statut'
);
