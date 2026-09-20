/*
  Warnings:

  - Changed the type of `nature` on the `champ_enrichissable` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- Remove rows that do not match the cahier des charges enum, and their dependents.
DELETE FROM "filtre_recherche"
 WHERE "id_champ_enrichissable" IN (
   SELECT "id" FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE'));

DELETE FROM "valeur_enrichissement"
 WHERE "id_champ_enrichissable" IN (
   SELECT "id" FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE'));

DELETE FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE');

-- CreateEnum
CREATE TYPE "NatureChamp" AS ENUM ('SAISISSABLE', 'CALCULE');

-- AlterTable
ALTER TABLE "champ_enrichissable"
  ALTER COLUMN "nature" TYPE "NatureChamp" USING ("nature"::"NatureChamp");
