// fait par eddy
const { verifierToken } = require('./jwt_maison');
const { estInvalide } = require('./blacklist');

function authMiddleware(req, res, next) {
  const enTeteAuth = req.headers.authorization;
  const token = enTeteAuth?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ erreur: 'Token manquant' });

  // vérif signature + expiration

  const payload = verifierToken(token, req.app.locals.SECRET_JWT);
  if (!payload) return res.status(401).json({ erreur: 'Token invalide' });

  // token révoqué (rotation)
  if (estInvalide(payload.jti)) {
    return res.status(401).json({ erreur: 'Token révoqué' });
  }

  req.payload = payload;
  req.jti = payload.jti;
  req.token = token; // pour PoW
  next();
}

module.exports = authMiddleware;
