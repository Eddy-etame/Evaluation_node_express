// fait par simone
// SHA256(token+nonce) doit commencer par 0000
const crypto = require('crypto');

const PREFIXE_ZEROS = '0000';

function proofOfWork(req, res, next) {
  const nonce = req.headers['x-pow-nonce'];
  const token = req.token; // JWT brut (authMiddleware)

  if (!nonce || !token) {
    return res.status(403).json({ erreur: 'Token et nonce requis' });
  }

  const hash = crypto.createHash('sha256').update(token + nonce).digest('hex');
  if (!hash.startsWith(PREFIXE_ZEROS)) {
    return res.status(403).json({ erreur: 'Preuve de travail invalide' });
  }
  next();
}

module.exports = proofOfWork;
