# Ajout de fonds dans les paramètres

Dans la PWA : **Plus → Paramètres → Ajouter des fonds**. Choisir CHF, EUR ou USD, saisir un montant positif avec deux décimales au maximum, puis appuyer sur « Ajouter les fonds ». Le projet utilise des fonds de démonstration : aucun prestataire de paiement ni réseau bancaire externe n’est connecté à cette action.

L’ajout est enregistré comme un dépôt dans la base, puis apparaît dans les comptes, l’accueil et l’historique. Le lien « Effectuer un virement » conduit au formulaire des bénéficiaires enregistrés. Le formulaire affiche le solde disponible du compte source et propose un raccourci vers les paramètres.

Dans le formulaire de virement, « Ajouter un bénéficiaire » ouvre la saisie du nom, du prénom facultatif, de la banque, de l’IBAN, du code SWIFT et de l’adresse de la banque. Après l’enregistrement, le bénéficiaire est sélectionné automatiquement et le montant, la devise, le type de virement et le motif sont conservés. « Annuler » retrouve aussi le virement en cours. Les bénéficiaires sont enregistrés pour le compte connecté et restent accessibles après rechargement. Une liste vide propose de créer le premier bénéficiaire ; une erreur de chargement propose « Réessayer ». Un IBAN déjà enregistré affiche une erreur sans remplacer le numéro saisi par un numéro généré.

Les opérations servant au solde sont limitées à l’utilisateur connecté. Les virements sont vérifiés côté serveur dans la même devise que le compte source. Les virements en attente réservent les fonds ; leur annulation les libère. Le bénéficiaire est crédité seulement lorsque le virement est terminé. Le projet n’inclut pas de moteur automatique de traitement à une date future.

Le dépôt, la modification du solde du bénéficiaire et l’écriture de l’historique utilisent des transactions MongoDB. Une écriture commune sur le compte utilisateur fait recommencer les virements concurrents avec un solde actualisé. Une erreur d’enregistrement annule les autres écritures de la même transaction. Les dépôts existants sont pris en compte depuis l’historique ; aucune migration de solde n’est nécessaire. Référence : [transactions Mongoose](https://mongoosejs.com/docs/transactions.html).

## Suppression des bénéficiaires

Dans la liste des bénéficiaires, la corbeille ouvre une confirmation. La fiche du bénéficiaire propose aussi « Supprimer le bénéficiaire ». Annuler conserve le bénéficiaire ; une erreur reste visible dans la confirmation pour permettre de réessayer.

La suppression retire le bénéficiaire de la liste, des favoris de cet appareil et des choix de nouveaux virements. Le serveur conserve sa référence pour que les opérations, les soldes et les virements déjà en attente restent cohérents. Elle n’annule pas les virements en attente : leur annulation se fait dans les opérations. Seul le propriétaire peut supprimer son bénéficiaire. Réenregistrer le même IBAN réactive la fiche et conserve son historique et son solde. Aucune migration n’est nécessaire pour les fiches existantes.

## Déploiement

Publier **le frontend et le backend**. La base doit prendre en charge les transactions : MongoDB Atlas ou un replica set local. Le fichier Docker Compose configure désormais un replica set à un membre. Pour une base Docker existante, recréer le service avec la nouvelle configuration en conservant son volume, puis attendre qu’il soit sain ; ne pas supprimer le volume. Pour une base MongoDB locale indépendante, la configurer comme replica set avant d’utiliser ces opérations.

## Contrôles

Dans le frontend : `npm run build`, puis `npm run verify:mobile`.

Dans le backend : `npm run verify:funds`. Ce contrôle crée une base MongoDB temporaire indépendante de `.env`, teste les montants, les devises, l’isolation des comptes, les fonds insuffisants, les réservations, les transferts simultanés et le retour arrière en cas d’erreur. Il vérifie aussi la suppression d’un bénéficiaire déjà utilisé, la conservation de l’historique et des soldes, le traitement des virements préexistants, la réactivation du même IBAN et la concurrence entre suppression et virement. Il utilise ensuite Chrome installé et le frontend compilé pour tester le parcours mobile complet : création, virement, suppression depuis la liste et la fiche, annulation, erreurs et reprise, doubles appuis, favoris et persistance. Le premier lancement télécharge un binaire MongoDB dans `.mongo-test-cache/`, ignoré par Git.
