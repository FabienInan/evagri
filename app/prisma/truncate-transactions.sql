-- Vider toutes les tables liées aux transactions
-- Ordre important à cause des contraintes de clés étrangères

DELETE FROM "panier_transaction";
DELETE FROM "document_acte";
DELETE FROM "indicateurs_ajustes";
DELETE FROM "parametres_analyse_transaction";
DELETE FROM "valeur_enrichissement";
DELETE FROM "transaction_enrichie";
DELETE FROM "transaction_source";

-- Réinitialiser les séquences d'auto-incrément si nécessaire (Prisma utilise des UUID donc pas besoin)
