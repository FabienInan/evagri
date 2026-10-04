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

-- Indicateurs calculés (§7.8.1). nature = CALCULE, est_modifiable = false (dérivé de la nature, §6.5).
-- Les identifiants de la règle sont résolus par le calculateur (lib/calculator.ts) : code_machine enrichi
-- d'abord, puis champ source. Ils sont traduits vers les codes réels produits par l'import
-- (buildCodeMachine : accents supprimés, suffixe d'unité conservé) et vers les codes sources
-- (transaction-source-fields.ts). Les paramètres d'évaluation propres au Dossier (§7.8.2 :
-- taux_boise_ref, taux_cultive_ref, valeur_batiments, valeur_maison, valeur_terrain_residentiel) et les
-- champs sans code réel (superficie_batiment, superficie_feuillu) restent littéraux : ils valent null
-- (affichage « — ») tant qu'aucun champ correspondant n'existe. Les indicateurs « (%) » multiplient par
-- 100, sinon l'arrondi entier (§7.5.4/§7.8.1) ramènerait toute fraction à 0.
INSERT INTO champ_enrichissable (
  id, id_organisation, code_machine, nom_affichage, type_donnees, nature, unite, applicable_a_types,
  plage_min, plage_max, options_liste, regle_calcul, ordre_affichage, est_affiche, est_obligatoire, est_modifiable, actif
)
VALUES
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'taux_global', 'Taux global', 'ENTIER', 'CALCULE', '$/ha', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, 'prix_vente / superficie_totale_hectare', 10, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'taux_residuel_cultive', 'Taux résiduel cultivé', 'ENTIER', 'CALCULE', '$/ha', '["TERRES_CULTIVEES"]', NULL, NULL, NULL, '(prix_vente - superficie_boise_ha * taux_boise_ref - valeur_batiments - valeur_maison - valeur_terrain_residentiel) / superficie_cultive_ha', 11, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'taux_residuel_boisee', 'Taux résiduel boisée', 'ENTIER', 'CALCULE', '$/ha', '["TERRES_BOISEES"]', NULL, NULL, NULL, '(prix_vente - superficie_cultive_ha * taux_cultive_ref - valeur_batiments - valeur_maison - valeur_terrain_residentiel) / superficie_boise_ha', 12, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'taux_residuel_batiment', 'Taux résiduel bâtiment', 'ENTIER', 'CALCULE', '$/pi²', '["BATIMENTS_AGRICOLES"]', NULL, NULL, NULL, '(prix_vente - superficie_cultive_ha * taux_cultive_ref - superficie_boise_ha * taux_boise_ref - valeur_maison - valeur_terrain_residentiel) / superficie_batiment', 13, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'terres_drainees', 'Terres drainées', 'ENTIER', 'CALCULE', '%', '["TERRES_CULTIVEES"]', NULL, NULL, NULL, 'superficie_draine_ha * 100 / superficie_cultive_ha', 14, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'peuplement_feuillu', 'Peuplement feuillu', 'ENTIER', 'CALCULE', '%', '["TERRES_BOISEES"]', NULL, NULL, NULL, 'superficie_feuillu * 100 / superficie_boise_ha', 15, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'zones_humides_potentielles', 'Zones humides potentielles', 'ENTIER', 'CALCULE', '%', '["TERRES_BOISEES"]', NULL, NULL, NULL, 'zones_humides_ha * 100 / superficie_boise_ha', 16, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'densite_entaillage', 'Densité d''entaillage', 'ENTIER', 'CALCULE', 'entailles/ha', '["ERABLIERES"]', NULL, NULL, NULL, 'nombre_dentailles / superficie_acricole_ha', 17, true, false, false, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'taux_par_entaille', 'Taux par entaille', 'ENTIER', 'CALCULE', '$/entaille', '["ERABLIERES"]', NULL, NULL, NULL, '(prix_vente - superficie_cultive_ha * taux_cultive_ref - valeur_batiments - valeur_maison - valeur_terrain_residentiel) / nombre_dentailles', 18, true, false, false, true)
ON CONFLICT (id_organisation, code_machine) DO NOTHING;

-- Champs saisis par l'évaluateur, référencés par les règles ci-dessus mais absents de la base.
-- Les 5 paramètres d'évaluation par Dossier du §7.8.2 (taux_boise_ref, taux_cultive_ref,
-- valeur_batiments, valeur_maison, valeur_terrain_residentiel) sont provisoirement seedés comme champs
-- saisissables par transaction, en attendant l'implémentation de l'Analyse de Dossier (§7.8.2).
INSERT INTO champ_enrichissable (
  id, id_organisation, code_machine, nom_affichage, type_donnees, nature, unite, applicable_a_types,
  plage_min, plage_max, options_liste, regle_calcul, ordre_affichage, est_affiche, est_obligatoire, est_modifiable, actif
)
VALUES
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'taux_boise_ref', 'Taux boisé de référence', 'DECIMAL', 'SAISISSABLE', '$/ha', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, NULL, 20, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'taux_cultive_ref', 'Taux cultivé de référence', 'DECIMAL', 'SAISISSABLE', '$/ha', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, NULL, 21, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'valeur_batiments', 'Valeur bâtiments', 'DECIMAL', 'SAISISSABLE', '$', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, NULL, 22, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'valeur_maison', 'Valeur maison', 'DECIMAL', 'SAISISSABLE', '$', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, NULL, 23, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'valeur_terrain_residentiel', 'Valeur terrain résidentiel', 'DECIMAL', 'SAISISSABLE', '$', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, NULL, 24, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'superficie_batiment', 'Superficie bâtiment', 'DECIMAL', 'SAISISSABLE', 'pi²', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, NULL, 25, true, false, true, true),
  (gen_random_uuid(), '90a5866e-06e5-46ce-9941-56582b8ca15c', 'superficie_feuillu', 'Superficie feuillu', 'DECIMAL', 'SAISISSABLE', 'ha', '["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "BATIMENTS_AGRICOLES", "FERME"]', NULL, NULL, NULL, NULL, 26, true, false, true, true)
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
