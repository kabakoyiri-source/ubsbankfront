const assert = require('node:assert/strict');

exports.checkEnglish = async page => {
  const rendered = await page.evaluate(() => ({
    language: document.documentElement.lang,
    text: document.body.innerText,
    labels: [...document.querySelectorAll('[aria-label], [placeholder]')].map(node => `${node.getAttribute('aria-label') || ''} ${node.getAttribute('placeholder') || ''}`).join(' '),
  }));
  assert.equal(rendered.language, 'en');
  const frenchCopy = /\b(?:Accueil|Paiements|Comptes|Cartes|Bénéficiaires?|Paramètres|Montant|Solde|Chargement|Veuillez|Réessayer|Connexion|Déconnexion|Annuler|Supprimer|Retour|Motifs?|Prénom|Sécurité|Devise|Virement|Créer|Oublier)\b/u;
  assert(!frenchCopy.test(rendered.text + ' ' + rendered.labels), 'Visible app copy and accessible labels must be in English');
};
