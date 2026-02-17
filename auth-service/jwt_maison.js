// fait par eddy
const crypto = require('crypto');

// base64 pour JWT : + -> -, / -> _, pas de =
function encoderBase64Url(chaine) {
  return Buffer.from(chaine)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// inverse de encoderBase64Url
function decoderBase64Url(chaine) {
  chaine = chaine.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - chaine.length % 4) % 4;
  return Buffer.from(chaine + '='.repeat(padding), 'base64').toString('utf8');
}


// HMAC-SHA256, output en base64url
function signer(donnees, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(donnees)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function creerToken(payload, secret) {
  const enTete = { alg: 'HS256', typ: 'JWT' };
  const enTeteB64 = encoderBase64Url(JSON.stringify(enTete));
  const payloadB64 = encoderBase64Url(JSON.stringify(payload));
  const signature = signer(`${enTeteB64}.${payloadB64}`, secret);
  return `${enTeteB64}.${payloadB64}.${signature}`;
}

function verifierToken(token, secret) {
  const parties = token.split('.');
  if (parties.length !== 3) return null;
  const [enTeteB64, payloadB64, signature] = parties;
  const signatureAttendue = signer(`${enTeteB64}.${payloadB64}`, secret);
  // timingSafeEqual = pas de fuite par temps d'exécution
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(signatureAttendue))) return null;
  const payload = JSON.parse(decoderBase64Url(payloadB64));
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

module.exports = { creerToken, verifierToken };
