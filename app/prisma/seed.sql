-- Seed minimal pour Evagri
-- Exécuter dans la console SQL de Neon ou avec psql

-- Organisation par défaut
INSERT INTO organisation (id, nom, actif, date_creation)
VALUES ('90a5866e-06e5-46ce-9941-56582b8ca15c', 'EVAGRI', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Typologies
INSERT INTO typologie (id, id_organisation, code, nom, ordre, est_type_mere, est_feuille, actif)
VALUES
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'TERRES_CULTIVEES', 'Terres cultivées', 1, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'TERRES_BOISEES', 'Terres boisées', 2, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'ERABLIERES', 'Érablières', 3, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'BATIMENTS_AGRICOLES', 'Bâtiments agricoles', 4, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'FERME', 'Ferme', 5, false, true, true)
ON CONFLICT (id_organisation, code) DO NOTHING;

-- Municipalités
INSERT INTO municipalite (id, id_organisation, nom_municipalite, mrc, region_administrative)
VALUES
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'Drummondville', 'Drummond', 'Centre-du-Québec'),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'Victoriaville', 'Arthabaska', 'Centre-du-Québec'),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'Nicolet', 'Nicolet-Yamaska', 'Centre-du-Québec')
ON CONFLICT (id_organisation, nom_municipalite) DO NOTHING;

-- Champs enrichissables sources
INSERT INTO champ_enrichissable (
  id, id_organisation, code_machine, nom_affichage, type_donnees, nature, unite, applicable_a_types,
  plage_min, plage_max, options_liste, regle_calcul, ordre_affichage, est_affiche, est_obligatoire, est_modifiable, actif
)
VALUES
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'numeroInscription', 'N° d''inscription', 'TEXTE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'dateVente', 'Date de vente', 'DATE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'vendeur', 'Vendeur', 'TEXTE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'acheteur', 'Acheteur', 'TEXTE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'lotsCadastraux', 'Lots', 'TEXTE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'prixVente', 'Prix de vente', 'DECIMAL', 'SOURCE', '$', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'mrc', 'MRC', 'TEXTE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'municipalite', 'Municipalité', 'TEXTE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'adresse', 'Adresse', 'TEXTE', 'SOURCE', 'N/A', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'superficieTotaleHectare', 'Superficie totale (ha)', 'DECIMAL', 'SOURCE', 'ha', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true)
ON CONFLICT (id_organisation, code_machine) DO NOTHING;

-- Champs géo
INSERT INTO champ_enrichissable (
  id, id_organisation, code_machine, nom_affichage, type_donnees, nature, unite, applicable_a_types,
  plage_min, plage_max, options_liste, regle_calcul, ordre_affichage, est_affiche, est_obligatoire, est_modifiable, actif
)
VALUES
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'latitude', 'Latitude', 'DECIMAL', 'SAISISSABLE', '°', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'longitude', 'Longitude', 'DECIMAL', 'SAISISSABLE', '°', '[]', NULL, NULL, NULL, NULL, 0, true, false, true, true)
ON CONFLICT (id_organisation, code_machine) DO NOTHING;

-- Type de transaction
INSERT INTO champ_enrichissable (
  id, id_organisation, code_machine, nom_affichage, type_donnees, nature, unite, applicable_a_types,
  plage_min, plage_max, options_liste, regle_calcul, ordre_affichage, est_affiche, est_obligatoire, est_modifiable, actif
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '90a5866e-06e5-46ce-9941-56582b8ca15c',
  'typeTransaction',
  'Type de transaction',
  'LISTE',
  'SAISISSABLE',
  'N/A',
  '[]',
  NULL,
  NULL,
  '["Terres cultivées", "Terres boisées", "Érablières", "Bâtiments agricoles", "Ferme"]',
  NULL,
  0,
  true,
  false,
  true,
  true
)
ON CONFLICT (id_organisation, code_machine) DO NOTHING;

-- Filtres virtuels
INSERT INTO filtre_recherche (
  id, id_organisation, id_champ_enrichissable, nom_filtre, type_filtre, operateurs_disponibles,
  ordre_affichage, est_actif, applicable_a_types, code_machine
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '90a5866e-06e5-46ce-9941-56582b8ca15c',
  '10000000-0000-0000-0000-000000000001',
  'Type de transaction',
  'LISTE',
  '["="]',
  0,
  true,
  '[]',
  NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO filtre_recherche (
  id, id_organisation, id_champ_enrichissable, nom_filtre, type_filtre, operateurs_disponibles,
  ordre_affichage, est_actif, applicable_a_types, code_machine
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '90a5866e-06e5-46ce-9941-56582b8ca15c',
  NULL,
  'Statut d''analyse',
  'LISTE',
  '["="]',
  1,
  true,
  '[]',
  'statut'
)
ON CONFLICT (id_organisation, code_machine) DO NOTHING;
