-- CreateTable
CREATE TABLE "organisation" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT,
    "role" TEXT NOT NULL,
    "mot_de_passe" TEXT NOT NULL,
    "consentement_politique_date" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipalite" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "nom_municipalite" TEXT NOT NULL,
    "mrc" TEXT NOT NULL,
    "region_administrative" TEXT NOT NULL,
    "code_postal_prefix" TEXT,

    CONSTRAINT "municipalite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_source" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "id_importation" TEXT,
    "systeme_source" TEXT NOT NULL,
    "numero_inscription" TEXT NOT NULL,
    "date_vente" DATE NOT NULL,
    "prix_vente" DECIMAL(15,2),
    "vendeur" TEXT,
    "acheteur" TEXT,
    "lots_cadastraux" TEXT[],
    "adresse" TEXT,
    "municipalite" TEXT,
    "mrc" TEXT,
    "superficie_totale_hectare" DECIMAL(12,4),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_enrichie" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "id_transaction_source" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'NON_ANALYSEE',
    "id_contributeur" TEXT,
    "date_statut" TIMESTAMP(3),
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_modification" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_enrichie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "champ_enrichissable" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "code_machine" TEXT NOT NULL,
    "nom_affichage" TEXT NOT NULL,
    "type_donnees" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "unite" TEXT NOT NULL DEFAULT 'N/A',
    "plage_min" DECIMAL(18,4),
    "plage_max" DECIMAL(18,4),
    "options_liste" JSONB,
    "regle_calcul" TEXT,
    "applicable_a_types" JSONB NOT NULL DEFAULT '[]',
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    "est_affiche" BOOLEAN NOT NULL DEFAULT true,
    "est_obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "est_modifiable" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "champ_enrichissable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filtre_recherche" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "id_champ_enrichissable" TEXT,
    "nom_filtre" TEXT NOT NULL,
    "type_filtre" TEXT NOT NULL,
    "operateurs_disponibles" JSONB,
    "ordre_affichage" INTEGER NOT NULL DEFAULT 0,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "applicable_a_types" JSONB,

    CONSTRAINT "filtre_recherche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valeur_enrichissement" (
    "id" TEXT NOT NULL,
    "id_transaction_enrichie" TEXT NOT NULL,
    "id_champ_enrichissable" TEXT NOT NULL,
    "valeur_nombre" DECIMAL(18,4),
    "valeur_texte" TEXT,
    "valeur_booleen" BOOLEAN,
    "date_modification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_modifie_par" TEXT,

    CONSTRAINT "valeur_enrichissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vue_fiche_evaluation" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "type_vue" TEXT NOT NULL,
    "contenu" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "vue_fiche_evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "typologie" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "id_type_parent" TEXT,
    "est_type_mere" BOOLEAN NOT NULL DEFAULT false,
    "est_feuille" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "typologie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "numero_dossier" TEXT NOT NULL,
    "nom" TEXT,
    "id_createur" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panier" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "id_dossier" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "id_type_transaction" TEXT,
    "id_createur" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panier_transaction" (
    "id_panier" TEXT NOT NULL,
    "id_transaction_enrichie" TEXT NOT NULL,
    "date_ajout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panier_transaction_pkey" PRIMARY KEY ("id_panier","id_transaction_enrichie")
);

-- CreateTable
CREATE TABLE "analyse_dossier" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "id_dossier" TEXT NOT NULL,
    "id_panier" TEXT,
    "date_evaluation" DATE NOT NULL,
    "taux_croissance" DECIMAL(5,4) NOT NULL,
    "id_createur" TEXT,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyse_dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametres_analyse_transaction" (
    "id" TEXT NOT NULL,
    "id_analyse_dossier" TEXT NOT NULL,
    "id_transaction_source" TEXT NOT NULL,
    "taux_boise_ref" DECIMAL(15,2),
    "taux_cultive_ref" DECIMAL(15,2),
    "valeur_batiment_ref" DECIMAL(15,2),
    "valeur_maison_ref" DECIMAL(15,2),
    "valeur_terrain_residentiel_ref" DECIMAL(15,2),

    CONSTRAINT "parametres_analyse_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicateurs_ajustes" (
    "id" TEXT NOT NULL,
    "id_analyse_dossier" TEXT NOT NULL,
    "id_transaction_source" TEXT NOT NULL,
    "prix_vente_ajuste" DECIMAL(15,2),
    "taux_global_ajuste" DECIMAL(15,2),
    "taux_residuel_cultive_ajuste" DECIMAL(15,2),
    "taux_residuel_boise_ajuste" DECIMAL(15,2),
    "taux_residuel_batiment_ajuste" DECIMAL(15,2),
    "taux_par_entaille_ajuste" DECIMAL(15,2),

    CONSTRAINT "indicateurs_ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_acte" (
    "id" TEXT NOT NULL,
    "id_transaction_source" TEXT NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "chemin_stockage" TEXT NOT NULL,
    "date_upload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_uploadeur" TEXT,

    CONSTRAINT "document_acte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importation" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "type_source" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "lignes_total" INTEGER NOT NULL,
    "lignes_inserees" INTEGER NOT NULL,
    "lignes_ignorees" INTEGER NOT NULL,
    "lignes_erreurs" INTEGER NOT NULL,
    "details" JSONB,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "id_organisation" TEXT NOT NULL,
    "table_cible" TEXT NOT NULL,
    "id_enregistrement" TEXT,
    "id_utilisateur" TEXT,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "adresse_ip" TEXT,
    "date_action" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_id_organisation_email_key" ON "utilisateur"("id_organisation", "email");

-- CreateIndex
CREATE UNIQUE INDEX "municipalite_id_organisation_nom_municipalite_key" ON "municipalite"("id_organisation", "nom_municipalite");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_source_id_organisation_numero_inscription_date__key" ON "transaction_source"("id_organisation", "numero_inscription", "date_vente");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_enrichie_id_transaction_source_key" ON "transaction_enrichie"("id_transaction_source");

-- CreateIndex
CREATE UNIQUE INDEX "champ_enrichissable_id_organisation_code_machine_key" ON "champ_enrichissable"("id_organisation", "code_machine");

-- CreateIndex
CREATE UNIQUE INDEX "valeur_enrichissement_id_transaction_enrichie_id_champ_enri_key" ON "valeur_enrichissement"("id_transaction_enrichie", "id_champ_enrichissable");

-- CreateIndex
CREATE UNIQUE INDEX "typologie_id_organisation_code_key" ON "typologie"("id_organisation", "code");

-- CreateIndex
CREATE UNIQUE INDEX "dossier_id_organisation_numero_dossier_key" ON "dossier"("id_organisation", "numero_dossier");

-- CreateIndex
CREATE UNIQUE INDEX "parametres_analyse_transaction_id_analyse_dossier_id_transa_key" ON "parametres_analyse_transaction"("id_analyse_dossier", "id_transaction_source");

-- CreateIndex
CREATE UNIQUE INDEX "indicateurs_ajustes_id_analyse_dossier_id_transaction_sourc_key" ON "indicateurs_ajustes"("id_analyse_dossier", "id_transaction_source");

-- AddForeignKey
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "municipalite" ADD CONSTRAINT "municipalite_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_source" ADD CONSTRAINT "transaction_source_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_source" ADD CONSTRAINT "transaction_source_id_importation_fkey" FOREIGN KEY ("id_importation") REFERENCES "importation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_enrichie" ADD CONSTRAINT "transaction_enrichie_id_transaction_source_fkey" FOREIGN KEY ("id_transaction_source") REFERENCES "transaction_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_enrichie" ADD CONSTRAINT "transaction_enrichie_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "champ_enrichissable" ADD CONSTRAINT "champ_enrichissable_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filtre_recherche" ADD CONSTRAINT "filtre_recherche_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filtre_recherche" ADD CONSTRAINT "filtre_recherche_id_champ_enrichissable_fkey" FOREIGN KEY ("id_champ_enrichissable") REFERENCES "champ_enrichissable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeur_enrichissement" ADD CONSTRAINT "valeur_enrichissement_id_transaction_enrichie_fkey" FOREIGN KEY ("id_transaction_enrichie") REFERENCES "transaction_enrichie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valeur_enrichissement" ADD CONSTRAINT "valeur_enrichissement_id_champ_enrichissable_fkey" FOREIGN KEY ("id_champ_enrichissable") REFERENCES "champ_enrichissable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vue_fiche_evaluation" ADD CONSTRAINT "vue_fiche_evaluation_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typologie" ADD CONSTRAINT "typologie_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "typologie" ADD CONSTRAINT "typologie_id_type_parent_fkey" FOREIGN KEY ("id_type_parent") REFERENCES "typologie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier" ADD CONSTRAINT "dossier_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panier" ADD CONSTRAINT "panier_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panier" ADD CONSTRAINT "panier_id_dossier_fkey" FOREIGN KEY ("id_dossier") REFERENCES "dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panier" ADD CONSTRAINT "panier_id_type_transaction_fkey" FOREIGN KEY ("id_type_transaction") REFERENCES "typologie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panier_transaction" ADD CONSTRAINT "panier_transaction_id_panier_fkey" FOREIGN KEY ("id_panier") REFERENCES "panier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panier_transaction" ADD CONSTRAINT "panier_transaction_id_transaction_enrichie_fkey" FOREIGN KEY ("id_transaction_enrichie") REFERENCES "transaction_enrichie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyse_dossier" ADD CONSTRAINT "analyse_dossier_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyse_dossier" ADD CONSTRAINT "analyse_dossier_id_dossier_fkey" FOREIGN KEY ("id_dossier") REFERENCES "dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyse_dossier" ADD CONSTRAINT "analyse_dossier_id_panier_fkey" FOREIGN KEY ("id_panier") REFERENCES "panier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametres_analyse_transaction" ADD CONSTRAINT "parametres_analyse_transaction_id_analyse_dossier_fkey" FOREIGN KEY ("id_analyse_dossier") REFERENCES "analyse_dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametres_analyse_transaction" ADD CONSTRAINT "parametres_analyse_transaction_id_transaction_source_fkey" FOREIGN KEY ("id_transaction_source") REFERENCES "transaction_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicateurs_ajustes" ADD CONSTRAINT "indicateurs_ajustes_id_analyse_dossier_fkey" FOREIGN KEY ("id_analyse_dossier") REFERENCES "analyse_dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicateurs_ajustes" ADD CONSTRAINT "indicateurs_ajustes_id_transaction_source_fkey" FOREIGN KEY ("id_transaction_source") REFERENCES "transaction_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_acte" ADD CONSTRAINT "document_acte_id_transaction_source_fkey" FOREIGN KEY ("id_transaction_source") REFERENCES "transaction_source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importation" ADD CONSTRAINT "importation_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_id_organisation_fkey" FOREIGN KEY ("id_organisation") REFERENCES "organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
