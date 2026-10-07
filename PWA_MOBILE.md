# Corrections de la PWA mobile

L’icône utilise le logo existant, centré sur un carré blanc opaque. Les nouvelles icônes `v4` portent sa largeur à 86 % du carré sur iOS et Android standard, soit environ 20 % de plus que la version précédente. Les variantes Android adaptatives utilisent la plus grande largeur qui garde tous les traits du logo dans la zone de sécurité circulaire, sans couper les clés. Les variantes Android font réellement 192 × 192 et 512 × 512 px ; l’icône iOS fait 180 × 180 px. Le système du téléphone applique lui-même les coins arrondis. Les fichiers `v3` sont conservés pour les anciennes pages encore actives.

Le démarrage Android utilise le manifeste blanc et les nouvelles icônes. Pour iOS, 38 images de lancement couvrent 19 combinaisons de taille/densité, en portrait et paysage. L’écran de chargement HTML puis React garde le même logo sur fond blanc. Les tailles iOS non couvertes restent à vérifier sur appareil.

La navigation principale est commune à toutes les pages : Accueil, Paiements, Comptes, Cartes et Plus. Sa hauteur hors marge système est de 50 px, contre 64 px auparavant. Les cibles tactiles gardent au moins 44 px et la zone gestuelle native reste réservée. Les trois actions de l’accueil ont des colonnes égales ; les contrôles de l’en-tête et les icônes du formulaire sont alignés. Les icônes CHF et EUR des favoris utilisent le même dessin et la même taille. Les styles des pages sont isolés ; les cartes et formulaires s’adaptent aux petits écrans et les fenêtres de confirmation passent au-dessus de la navigation. Les champs mobiles gardent une taille de texte de 16 px, et le zoom utilisateur reste disponible.

Les montants utilisent un format commun : `1'234'567,89`, avec des apostrophes pour les milliers et une virgule pour les centimes. Les champs de montant groupent aussi les chiffres pendant la saisie et transmettent au serveur leur valeur numérique sans séparateurs. Les champs acceptent une virgule ou un point pour les décimales et des montants copiés avec apostrophes ou espaces. La sélection CHF/EUR/USD modifie simultanément la devise du gain, son pourcentage et la courbe de démonstration ; ces aperçus illustratifs ne proviennent pas d’un cours de marché en direct.

Les échecs réseau affichent un message avec une action pour réessayer. Une panne réseau ne supprime plus la session enregistrée. La déconnexion efface aussi l’opération sélectionnée. Les rubriques du menu Plus sans fonctionnalité sont indiquées comme indisponibles.

La connexion propose « Mémoriser mes identifiants sur cet appareil », activé par défaut pour ce projet personnel. Après une connexion réussie, l’email et le mot de passe sont restaurés au retour sur le formulaire, y compris après déconnexion ou expiration de la session. Le mot de passe reste masqué à l’écran et est stocké chiffré avec AES-GCM dans IndexedDB, avec une clé non exportable. Ce stockage appartient au navigateur et au site : effacer ses données supprime aussi les identifiants. Le bouton « Oublier mes identifiants » efface le mot de passe enregistré et la clé. La déconnexion conserve volontairement les identifiants mémorisés.

Cette option est réservée à un appareil personnel : une personne ayant accès à la PWA peut se reconnecter en appuyant sur le bouton. Le chiffrement local ne protège pas contre un script malveillant exécuté par le même site. Aucun identifiant n’est mémorisé si la connexion échoue. Si le navigateur ne permet pas le stockage, la connexion manuelle reste disponible. Référence de stockage des clés : [Web Cryptography, W3C](https://www.w3.org/TR/WebCryptoAPI/#concepts-key-storage).

Le cache inclut les fichiers JavaScript et CSS produits par la compilation. Les requêtes API ne sont pas mises en cache. Une mise à jour attend l’action « Actualiser », sans interrompre automatiquement un formulaire ; cette action recharge la page et efface donc les saisies non enregistrées.

Chaque service worker sert la page HTML et les fichiers de sa propre compilation. Il ne mélange plus une nouvelle page HTML avec d’anciens fichiers en cache. L’installation vérifie aussi les types des fichiers : une réponse HTML reçue à la place d’un fichier JavaScript ou CSS fait échouer la nouvelle installation, en conservant la version active. Les chemins des fichiers statiques manquants ne sont plus réécrits vers la page HTML par Vercel.

Les anciens caches `ubs-bank-v1` / `ubs-bank-v2` ne contenaient que la page et le logo. Si leurs fichiers JavaScript/CSS sont absents ou invalides, le nouveau service worker s’active automatiquement après avoir entièrement téléchargé et validé la nouvelle compilation, puis recharge les fenêtres contrôlées. Les mises à jour d’une installation fonctionnelle attendent toujours le bouton « Actualiser ». Une nouvelle installation incomplète conserve le cache précédent.

Si un fichier de démarrage échoue malgré tout, la page HTML affiche « Réparer et recharger », même si React ne démarre pas. Cette action vérifie la connexion, retire le service worker de l’application et ses caches, puis recharge une URL actualisée. Elle conserve localStorage et IndexedDB, donc les identifiants mémorisés. Elle ne purge aucun cache si le site est inaccessible. Pour sortir d’une ancienne page sans ce bouton, ouvrir [la page de réparation](https://ubsbankfront.vercel.app/?pwa-repair=1) sur le téléphone après déploiement. Cette URL demande une page fraîche au réseau ; hors connexion, la version installée reste disponible. Si l’ancienne PWA est encore ouverte, la fermer complètement et la rouvrir après cette visite.

Le démarrage n’est marqué comme réussi qu’après le premier affichage React et la vérification du chargement des styles. Si les fichiers arrivent après l’affichage du secours, l’application redevient visible dès que son démarrage réussit.

## Vérification

La compilation et le script `scripts/verify-mobile.cjs` vérifient 15 écrans sur six formats, les dimensions des icônes et leur zone de sécurité, les images de lancement, les marges système simulées, la déconnexion, les erreurs de connexion, la reprise après une panne, les fenêtres de confirmation en paysage, le cache hors ligne et l’activation d’une mise à jour. Les données API sont simulées : aucune transaction réelle n’est créée.

Pour relancer les contrôles :

```text
npm run build
npm run verify:mobile
npm run verify:pwa-recovery
```

Le contrôle utilise Chrome installé localement. Les captures et le rapport sont écrits dans `qa/`, un dossier ignoré par Git.

Pour régénérer les icônes et les images iOS sous Windows :

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-pwa-assets.ps1
npm run build
```

## Installation sur téléphone

Publier la nouvelle compilation sur l’hébergement HTTPS habituel. Le site n’a pas été déployé par ces modifications locales. Si l’ancienne PWA conserve son icône, retirer son raccourci/application installée puis réinstaller depuis le site mis à jour. Fermer toutes les anciennes fenêtres permet aussi à l’ancien service worker de céder sa place.

Les écrans natifs de lancement, le clavier et les zones système doivent encore être contrôlés sur un vrai Android et un vrai iPhone. Les vérifications automatisées utilisent Chrome avec des tailles d’écran et des marges simulées. Les cartes et la courbe de trading préexistantes restent des données de démonstration.

Références : [zone de sécurité des icônes adaptatives](https://web.dev/articles/maskable-icon) et [marges système et viewport iPhone](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
