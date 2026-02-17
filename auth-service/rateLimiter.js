// fait par brad
// 10 req / 30 sec par jti (pas par IP)
const carteLimite = new Map();
const REQUETES_MAX = 10;
const FENETRE_MS = 30 * 1000;

function limiteurDeRequetes(req, res, next) {
  const jti = req.jti;
  if (!jti) return next();

  const maintenant = Date.now();
  let enregistrement = carteLimite.get(jti);

  // premier appel pour ce jti
  if (!enregistrement) {
    enregistrement = { compteur: 1, debutFenetre: maintenant };
    carteLimite.set(jti, enregistrement);
    return next();
  }

  // fenêtre expirée, on reset
  if (maintenant - enregistrement.debutFenetre > FENETRE_MS) {
    enregistrement.compteur = 1;
    enregistrement.debutFenetre = maintenant;
    return next();
  }

  enregistrement.compteur++;
  if (enregistrement.compteur > REQUETES_MAX) {
    return res.status(429).json({ erreur: 'Trop de requêtes' });
  }
  next();
}

module.exports = limiteurDeRequetes;
