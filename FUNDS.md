# Ajout de fonds dans les paramètres

Dans la PWA : **Plus → Paramètres → Ajouter des fonds**. Choisir CHF, EUR ou USD, saisir un montant positif avec deux décimales au maximum, puis appuyer sur « Ajouter les fonds ». Le projet utilise des fonds de démonstration : aucun prestataire de paiement ni réseau bancaire externe n’est connecté à cette action.

L’ajout est enregistré comme un dépôt dans la base, puis apparaît dans les comptes, l’accueil et l’historique. Le lien « Effectuer un virement » conduit au formulaire des bénéficiaires enregistrés. Le formulaire affiche le solde disponible du compte source et propose un raccourci vers les paramètres.

Dans le formulaire de virement, « Ajouter un bénéficiaire » ouvre la saisie du nom, du prénom facultatif, de la banque, de l’IBAN, du code SWIFT et de l’adresse de la banque. Après l’enregistrement, le bénéficiaire est sélectionné automatiquement et le montant, la devise, le type de virement et le motif sont conservés. « Annuler » retrouve aussi le virement en cours. Les bénéficiaires sont enregistrés pour le compte connecté et restent accessibles après rechargement. Une liste vide propose de créer le premier bénéficiaire ; une erreur de chargement propose « Réessayer ». Un IBAN déjà enregistré affiche une erreur sans remplacer le numéro saisi par un numéro généré.

Les opérations servant au solde sont limitées à l’utilisateur connecté. Les virements sont vérifiés côté serveur dans la même devise que le compte source. Les virements en attente réservent les fonds ; leur annulation les libère. Le bénéficiaire est crédité seulement lorsque le virement est terminé. Le projet n’inclut pas de moteur automatique de traitement à une date future.

Le dépôt, la modification du solde du bénéficiaire et l’écriture de l’historique utilisent une fonction SQL transactionnelle dans Supabase. Un verrou sur la ligne utilisateur sérialise les mutations avant de vérifier les fonds. Une erreur annule toutes les écritures de la transaction. Les soldes sont calculés depuis l’historique importé.

## Suppression des bénéficiaires

Dans la liste des bénéficiaires, la corbeille ouvre une confirmation. La fiche du bénéficiaire propose aussi « Supprimer le bénéficiaire ». Annuler conserve le bénéficiaire ; une erreur reste visible dans la confirmation pour permettre de réessayer.

La suppression retire le bénéficiaire de la liste, des favoris de cet appareil et des choix de nouveaux virements. Le serveur conserve sa référence pour que les opérations, les soldes et les virements déjà en attente restent cohérents. Elle n’annule pas les virements en attente : leur annulation se fait dans les opérations. Seul le propriétaire peut supprimer son bénéficiaire. Réenregistrer le même IBAN réactive la fiche et conserve son historique et son solde. Aucune migration n’est nécessaire pour les fiches existantes.

## Déploiement

Importer le SQL complet dans Supabase, renseigner les deux variables Supabase du frontend, puis publier uniquement le frontend. Voir [le guide de migration](supabase/README.md). La connexion utilise `usb_users` et les fonctions SQL ; Supabase Auth n’est pas utilisé.

## Contrôles

Dans le frontend : `npm run verify:supabase`, puis `npm run build:qa` et `npm run verify:supabase-ui`. Les contrôles de mise en page restent disponibles avec `npm run verify:mobile` et `npm run verify:ios`.

Ces contrôles utilisent PostgreSQL temporaire via PGlite et Chrome, sans accès à Atlas. Ils vérifient l’import réel, les montants, les devises, l’isolation, les réservations, le retour arrière en cas d’erreur, la suppression des bénéficiaires et la réactivation du même IBAN. L’interface teste aussi les erreurs et leur reprise, les doubles appuis, les favoris, la persistance, l’inscription et la déconnexion. Refaire `npm run build` avec la vraie configuration avant publication.
