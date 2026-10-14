/*
  Warnings:

  - You are about to drop the column `id_transaction_source` on the `document_acte` table. All the data in the column will be lost.
  - You are about to drop the column `id_champ_enrichissable` on the `filtre_recherche` table. All the data in the column will be lost.
  - You are about to drop the column `id_transaction_source` on the `indicateurs_ajustes` table. All the data in the column will be lost.
  - The primary key for the `panier_transaction` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id_transaction_enrichie` on the `panier_transaction` table. All the data in the column will be lost.
  - You are about to drop the column `id_transaction_source` on the `parametres_analyse_transaction` table. All the data in the column will be lost.
  - You are about to drop the `champ_enrichissable` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transaction_enrichie` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transaction_source` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `valeur_enrichissement` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id_analyse_dossier,id_transaction]` on the table `indicateurs_ajustes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_analyse_dossier,id_transaction]` on the table `parametres_analyse_transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_transaction` to the `document_acte` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_transaction` to the `indicateurs_ajustes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_transaction` to the `panier_transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_transaction` to the `parametres_analyse_transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatutTransaction" AS ENUM ('NON_ANALYSEE', 'ANALYSEE');

-- DropForeignKey
ALTER TABLE "champ_enrichissable" DROP CONSTRAINT "champ_enrichissable_id_organisation_fkey";

-- DropForeignKey
ALTER TABLE "document_acte" DROP CONSTRAINT "document_acte_id_transaction_source_fkey";

-- DropForeignKey
ALTER TABLE "filtre_recherche" DROP CONSTRAINT "filtre_recherche_id_champ_enrichissable_fkey";

-- DropForeignKey
ALTER TABLE "indicateurs_ajustes" DROP CONSTRAINT "indicateurs_ajustes_id_transaction_source_fkey";

-- DropForeignKey
ALTER TABLE "panier_transaction" DROP CONSTRAINT "panier_transaction_id_transaction_enrichie_fkey";

-- DropForeignKey
ALTER TABLE "parametres_analyse_transaction" DROP CONSTRAINT "parametres_analyse_transaction_id_transaction_source_fkey";

-- DropForeignKey
ALTER TABLE "transaction_enrichie" DROP CONSTRAINT "transaction_enrichie_id_organisation_fkey";

-- DropForeignKey
ALTER TABLE "transaction_enrichie" DROP CONSTRAINT "transaction_enrichie_id_transaction_source_fkey";

-- DropForeignKey
ALTER TABLE "transaction_source" DROP CONSTRAINT "transaction_source_id_importation_fkey";

-- DropForeignKey
ALTER TABLE "transaction_source" DROP CONSTRAINT "transaction_source_id_organisation_fkey";

-- DropForeignKey
ALTER TABLE "valeur_enrichissement" DROP CONSTRAINT "valeur_enrichissement_id_champ_enrichissable_fkey";

-- DropForeignKey
ALTER TABLE "valeur_enrichissement" DROP CONSTRAINT "valeur_enrichissement_id_transaction_enrichie_fkey";

-- DropIndex
DROP INDEX "indicateurs_ajustes_id_analyse_dossier_id_transaction_sourc_key";

-- DropIndex
DROP INDEX "parametres_analyse_transaction_id_analyse_dossier_id_transa_key";

-- AlterTable
ALTER TABLE "document_acte" DROP COLUMN "id_transaction_source",
ADD COLUMN     "id_transaction" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "filtre_recherche" DROP COLUMN "id_champ_enrichissable",
ADD COLUMN     "id_champ" TEXT;

-- AlterTable
ALTER TABLE "indicateurs_ajustes" DROP COLUMN "id_transaction_source",
ADD COLUMN     "id_transaction" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "panier_transaction" DROP CONSTRAINT "panier_transaction_pkey",
DROP COLUMN "id_transaction_enrichie",
ADD COLUMN     "id_transaction" TEXT NOT NULL,
ADD CONSTRAINT "panier_transaction_pkey" PRIMARY KEY ("id_panier", "id_transaction");

-- AlterTable
ALTER TABLE "parametres_analyse_transaction" DROP COLUMN "id_transaction_source",
ADD COLUMN     "id_transaction" TEXT NOT NULL;

-- DropTable
DROP TABLE "champ_enrichissable";

-- DropTable
DROP TABLE "transaction_enrichie";

-- DropTable
DROP TABLE "transaction_source";

-- DropTable
DROP TABLE "valeur_enrichissement";

-- DropEnum
DROP TYPE "NatureChamp";

-- CreateEnum
CREATE TYPE "NatureChamp" AS ENUM ('IMPORTE', 'SAISISSABLE', 'CALCULE');

-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "id_importation" TEXT,
    "systeme_source" TEXT NOT NULL,
    "statut" "StatutTransaction" NOT NULL DEFAULT 'NON_ANALYSEE',
    "id_contributeur" TEXT,
    "date_statut" TIMESTAMP(3),
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "champ" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "code_machine" TEXT NOT NULL,
    "nom_affichage" TEXT NOT NULL,
    "type_donnees" TEXT NOT NULL,
    "type_filtre_recommande" TEXT,
    "nature" "NatureChamp" NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'N/A',
    "plage_min" DECIMAL(18,4),
    "plage_max" DECIMAL(18,4),
    "options_liste" JSONB,
    "regle_calcul" TEXT,
    "entetes_import" JSONB,
    "applicable_a_types" JSONB NOT NULL DEFAULT '[]',
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    "est_affiche" BOOLEAN NOT NULL DEFAULT true,
    "est_lecture_seule" BOOLEAN NOT NULL DEFAULT true,
    "est_obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "champ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valeur_champ" (
    "id" TEXT NOT NULL,
    "id_transaction" TEXT NOT NULL,
    "id_champ" TEXT NOT NULL,
    "valeur_nombre" DECIMAL(18,4),
    "valeur_texte" TEXT,
    "valeur_texte_multiple" TEXT[],
    "valeur_booleen" BOOLEAN,
    "valeur_date" DATE,
    "date_modification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_modifie_par" TEXT,

    CONSTRAINT "valeur_champ_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "champ_id_organisation_code_machine_key" ON "champ"("id_organisation", "code_machine");

-- CreateIndex
CREATE INDEX "valeur_champ_id_champ_valeur_texte_idx" ON "valeur_champ"("id_champ", "valeur_texte");

-- CreateIndex
CREATE INDEX "valeur_champ_id_champ_valeur_date_idx" ON "valeur_champ"("id_champ", "valeur_date");

-- CreateIndex
CREATE INDEX "valeur_champ_valeur_texte_multiple_idx" ON "valeur_champ" USING GIN ("valeur_texte_multiple" array_ops);

-- CreateIndex
CREATE UNIQUE INDEX "valeur_champ_id_transaction_id_champ_key" ON "valeur_champ"("id_transaction", "id_champ");

-- CreateIndex
CREATE UNIQUE INDEX "indicateurs_ajustes_id_analyse_dossier_id_transaction_key" ON "indicateurs_ajustes"("id_analyse_dossier", "id_transaction");

-- CreateIndex
CREATE UNIQUE INDEX "parametres_analyse_transaction_id_analyse_dossier_id_transa_key" ON "parametres_analyse_transaction"("id_analyse_dossier", "id_transaction");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_id_importation_fkey" FOREIGN KEY ("id_importation") REFERENCES "importation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champ" ADD CONSTRAINT "champ_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filtre_recherche" ADD CONSTRAINT "filtre_recherche_id_champ_fkey" FOREIGN KEY ("id_champ") REFERENCES "champ"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeur_champ" ADD CONSTRAINT "valeur_champ_id_transaction_fkey" FOREIGN KEY ("id_transaction") REFERENCES "transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeur_champ" ADD CONSTRAINT "valeur_champ_id_champ_fkey" FOREIGN KEY ("id_champ") REFERENCES "champ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panier_transaction" ADD CONSTRAINT "panier_transaction_id_transaction_fkey" FOREIGN KEY ("id_transaction") REFERENCES "transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametres_analyse_transaction" ADD CONSTRAINT "parametres_analyse_transaction_id_transaction_fkey" FOREIGN KEY ("id_transaction") REFERENCES "transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicateurs_ajustes" ADD CONSTRAINT "indicateurs_ajustes_id_transaction_fkey" FOREIGN KEY ("id_transaction") REFERENCES "transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_acte" ADD CONSTRAINT "document_acte_id_transaction_fkey" FOREIGN KEY ("id_transaction") REFERENCES "transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
