# Migration Atlas → frontend + Supabase

Le frontend appelle directement les fonctions SQL de Supabase. Aucun serveur Express, aucune connexion MongoDB et aucun Supabase Auth ne sont nécessaires à l’application.

## Importer les données

L’export effectué le **19 octobre 2026 à 23:25 UTC** contient **8 utilisateurs, 4 bénéficiaires et 14 opérations**. Les 26 documents d’origine, y compris leurs champs supplémentaires, sont aussi conservés en Extended JSON dans une table SQL privée.

1. Ouvrir le projet Supabase cible, puis son **SQL Editor**.
2. Ouvrir le fichier local **`supabase/exports/usb_supabase_complete.sql`** et exécuter son contenu. Il contient le schéma et les véritables données Atlas, pas des données d’exemple. Il faut l’exécuter avec le compte administrateur SQL habituel du projet.
3. Vérifier les quantités avec :

```sql
select 'usb_users' as table_name, count(*) from public.usb_users
union all select 'usb_beneficiaries', count(*) from public.usb_beneficiaries
union all select 'usb_operations', count(*) from public.usb_operations
union all select 'usb_migration_documents', count(*) from usb_private.usb_migration_documents;
-- Pour un projet vide : 8, 4, 14, 26.
```

Les tables créées sont `public.usb_users`, `public.usb_beneficiaries`, `public.usb_operations`, `usb_private.usb_sessions`, `usb_private.usb_login_attempts` et `usb_private.usb_migration_documents`. Elles commencent toutes par `usb_`. Le schéma Supabase Auth n’est pas utilisé et aucune table `auth.users` n’est créée ou alimentée.

Les identifiants MongoDB restent identiques pour conserver les relations et les liens de l’application. Les mots de passe bcrypt restent hachés et inchangés ; les utilisateurs gardent leurs identifiants de connexion. Le script est transactionnel pour les données. Une nouvelle exécution ne remplace pas les données déjà présentes ; utiliser un projet neuf pour l’import initial. Un conflit d’email avec un compte cible différent bloque l’import au lieu d’écraser ce compte.

Les fichiers `exports/` contiennent des données personnelles et des hachages de mots de passe. Ils sont ignorés par Git et ne sont pas copiés dans le dossier publié `dist/`. Ne pas les mettre dans `public/`.

## Brancher le frontend

Renseigner ces deux valeurs dans `frontend/.env`, ou dans les variables d’environnement de l’hébergement :

```dotenv
VITE_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLIQUE
```

L’ancienne clé publique `anon` est aussi acceptée sous le nom `VITE_SUPABASE_ANON_KEY`. Utiliser une clé publique, jamais `service_role` ou une clé secrète. Aucun paramètre Supabase Auth n’est à activer.

Puis, dans `frontend/` :

```text
npm install
npm run build
```

Pour Vercel : dossier du projet **frontend**, commande de build **npm run build**, dossier de sortie **dist**. Ajouter les deux variables avant de reconstruire. Le backend ne doit plus être déployé. Les fichiers sources `.env` et les exports SQL ne font pas partie du build.

Tester une connexion avec un compte importé, ses soldes, ses bénéficiaires et son historique. L’inscription crée directement une ligne dans `usb_users`. Une session aléatoire est créée par SQL ; seul son hachage est conservé côté base. La sortie de la PWA efface immédiatement la connexion locale et tente de révoquer la session. Si le téléphone coupe le réseau à cet instant, la session distante expire au plus tard après 12 heures. Les identifiants mémorisés sur l’appareil restent disponibles comme avant.

Les tables ne sont pas lisibles directement avec la clé publique. Les fonctions SQL vérifient la session et limitent les données au propriétaire. Les virements et les soldes sont modifiés dans une transaction PostgreSQL ; un verrou par utilisateur évite la dépense simultanée des mêmes fonds. La suppression d’un bénéficiaire conserve les opérations existantes.

## Rafraîchir l’export avant la bascule

Si des données ont changé sur Atlas depuis l’export, arrêter les écritures de l’ancienne application et relancer :

```text
npm run export:atlas -- --env-file CHEMIN_DU_FICHIER_PRIVE_CONTENANT_MONGODB_URI
```

Le script effectue seulement des lectures, avec un snapshot commun aux collections. L’ancien `.env` est aussi retrouvé dans l’archive locale du backend si elle existe. Pour régénérer le SQL à partir de la sauvegarde, sans accéder à Atlas :

```text
npm run export:atlas -- --snapshot supabase/exports/atlas-snapshot.ejson
```

Fichiers produits : `002_atlas_data.sql`, `usb_supabase_complete.sql`, `atlas-snapshot.ejson` et `manifest.json` avec les quantités et l’empreinte SHA-256 du SQL complet. Conserver ces fichiers privés.

Atlas n’a pas été effacé pendant la préparation. Après import et vérification sur Supabase, arrêter l’ancien hébergement puis supprimer la base/le cluster Atlas depuis son tableau de bord si vous souhaitez le retirer définitivement. L’ancien backend est conservé seulement dans `.migration-archive/backend-before-supabase`, hors du frontend publié, pour permettre un retour arrière.

## Vérifications locales

```text
npm run verify:supabase
npm run build:qa
npm run verify:supabase-ui
npm run verify:mobile
npm run verify:ios
npm run verify:pwa-recovery
```

`verify:supabase` exécute le vrai schéma et l’import sur PostgreSQL via PGlite, dans une base temporaire. Les contrôles d’interface utilisent les RPC SQL temporaires ou des données de test, jamais Atlas. La connexion au projet Supabase hébergé reste à vérifier après import et ajout de sa configuration. PGlite sérialise ses transactions ; les tests concurrents vérifient les résultats sérialisés, sans remplacer un test de charge du serveur hébergé.

`build:qa` utilise un point d’accès local simulé, réservé aux tests. **Après les contrôles, refaire `npm run build` avec la vraie configuration avant de publier.** WebKit et les marges système simulées ne remplacent pas un essai sur iPhone physique.

Références : [fonctions de base de données Supabase](https://supabase.com/docs/guides/database/functions), [protection des tables](https://supabase.com/docs/guides/database/postgres/row-level-security), [clés API publiques](https://supabase.com/docs/guides/api/api-keys).
