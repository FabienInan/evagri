/*
  Warnings:

  - You are about to drop the column `id_panier` on the `analyse_dossier` table. All the data in the column will be lost.
  - You are about to drop the `parametres_analyse_transaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "analyse_dossier" DROP CONSTRAINT "analyse_dossier_id_panier_fkey";

-- DropForeignKey
ALTER TABLE "parametres_analyse_transaction" DROP CONSTRAINT "parametres_analyse_transaction_id_analyse_dossier_fkey";

-- DropForeignKey
ALTER TABLE "parametres_analyse_transaction" DROP CONSTRAINT "parametres_analyse_transaction_id_transaction_fkey";

-- AlterTable
ALTER TABLE "analyse_dossier" DROP COLUMN "id_panier",
ADD COLUMN     "taux_boise_ref" DECIMAL(15,2),
ADD COLUMN     "taux_cultive_ref" DECIMAL(15,2),
ADD COLUMN     "valeur_batiment_ref" DECIMAL(15,2),
ADD COLUMN     "valeur_maison_ref" DECIMAL(15,2),
ADD COLUMN     "valeur_terrain_residentiel_ref" DECIMAL(15,2);

-- DropTable
DROP TABLE "parametres_analyse_transaction";
