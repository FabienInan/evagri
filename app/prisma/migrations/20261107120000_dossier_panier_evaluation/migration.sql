-- Date d'évaluation portée par le dossier et taux de croissance porté par le panier (au lieu de l'analyse).
ALTER TABLE "dossier" ADD COLUMN "date_evaluation" DATE;
ALTER TABLE "panier" ADD COLUMN "taux_croissance" DECIMAL(5,4);

-- Reprise des valeurs de la dernière analyse de chaque dossier (les paramètres ne sont pas perdus).
UPDATE "dossier" d
SET "date_evaluation" = a."date_evaluation"
FROM (
  SELECT DISTINCT ON ("id_dossier") "id_dossier", "date_evaluation"
  FROM "analyse_dossier"
  ORDER BY "id_dossier", "date_creation" DESC
) a
WHERE a."id_dossier" = d."id";

UPDATE "panier" p
SET "taux_croissance" = a."taux_croissance"
FROM (
  SELECT DISTINCT ON ("id_dossier") "id_dossier", "taux_croissance"
  FROM "analyse_dossier"
  ORDER BY "id_dossier", "date_creation" DESC
) a
WHERE a."id_dossier" = p."id_dossier";

-- Les résultats ajustés sont recalculés à l'export : les tables d'analyse disparaissent.
DROP TABLE "indicateurs_ajustes";
DROP TABLE "analyse_dossier";
