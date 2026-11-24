-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "echecs_connexion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verrouille_jusqua" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_id_contributeur_fkey" FOREIGN KEY ("id_contributeur") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
