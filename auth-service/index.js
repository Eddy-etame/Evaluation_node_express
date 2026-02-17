require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const crypto = require('crypto');
const { creerToken } = require('./jwt_maison');
const authMiddleware = require('./authMiddleware');
const limiteurDeRequetes = require('./rateLimiter');
const proofOfWork = require('./pOW');
const { invalider } = require('./blacklist');
const { creerTokenInterne } = require('../data-service/authInterne');
const gestionnaireErreur = require('./middlewareErreur');

const app = express();
app.use(express.json());

const PORT = 3000;
const CLE_SECRETE = process.env.CLE_SECRETE || 'secret-par-defaut';
const POIVRE_PRINCIPAL = process.env.POIVRE_PRINCIPAL || 'poivre-principal';
const SECRET_JWT = CLE_SECRETE + POIVRE_PRINCIPAL;

app.locals.SECRET_JWT = SECRET_JWT;

// auth + rate limit + PoW sur toutes les routes protégées
const routeProtegee = [authMiddleware, limiteurDeRequetes, proofOfWork];

app.post('/auth/login', (req, res) => {
  const sub = req.body?.userId || 'user-1';
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 5 * 60; // 5 min
  const jti = crypto.randomUUID();
  const token = creerToken({ sub, iat, exp, jti }, SECRET_JWT);
  res.json({ token });
});

app.post('/auth/rotate', ...routeProtegee, (req, res) => {
  invalider(req.jti);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 5 * 60;
  const jti = crypto.randomUUID();
  const token = creerToken(
    { sub: req.payload.sub, iat, exp, jti },
    SECRET_JWT
  );
  res.json({ token });
});

app.get('/protected', ...routeProtegee, (req, res) => {
  res.json({ message: 'OK', userId: req.payload.sub });
});

app.get('/secure-data', ...routeProtegee, async (req, res, next) => {
  try {
    const tokenInterne = creerTokenInterne({ from: req.payload.sub, ts: Date.now() });
    const reponse = await fetch('http://localhost:3001/internal/data', {
      headers: { 'X-INTERNAL-TOKEN': tokenInterne }
    });
    if (!reponse.ok) {
      const err = new Error('Service de données indisponible');
      err.statut = 503;
      throw err;
    }
    const donnees = await reponse.json();
    res.json(donnees);
  } catch (err) {
    if (!err.statut) err.statut = 503;
    next(err);
  }
});

app.use(gestionnaireErreur);

app.listen(PORT, () => {
  console.log(`Service d'authentification sur le port ${PORT}`);
});
