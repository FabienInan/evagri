-- CreateIndex
CREATE INDEX "transaction_id_organisation_idx" ON "transaction"("id_organisation");

-- CreateIndex
CREATE INDEX "transaction_id_importation_idx" ON "transaction"("id_importation");

-- CreateIndex
CREATE INDEX "valeur_champ_id_champ_valeur_nombre_idx" ON "valeur_champ"("id_champ", "valeur_nombre");
