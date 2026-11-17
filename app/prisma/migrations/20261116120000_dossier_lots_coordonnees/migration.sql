-- Lots cadastraux et coordonnées portés par le dossier (géocodage Demeter à la création, saisie manuelle sinon).
ALTER TABLE "dossier" ADD COLUMN "lots_cadastraux" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "latitude" DECIMAL(9,6),
ADD COLUMN "longitude" DECIMAL(9,6);
