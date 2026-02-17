// tokens signés avec CLE_SECRETE + POIVRE_SECONDAIRE (pas les JWT users)
const crypto = require('crypto');

const CLE_SECRETE = process.env.CLE_SECRETE || 'secret-simone-eddy-brad';
const POIVRE_SECONDAIRE = process.env.POIVRE_SECONDAIRE || 'poivre-simone-eddy-brad';
const SECRET_INTERNE = CLE_SECRETE + POIVRE_SECONDAIRE;

function creerTokenInterne(payload) {
  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', SECRET_INTERNE)
    .update(payloadStr)
    .digest('hex');
  return Buffer.from(JSON.stringify({ payload: payloadStr, sig: signature })).toString('base64');
}

function verifierTokenInterne(token) {
  try {
    const decode = JSON.parse(Buffer.from(token, 'base64').toString());
    const signatureAttendue = crypto
      .createHmac('sha256', SECRET_INTERNE)
      .update(decode.payload)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(decode.sig), Buffer.from(signatureAttendue))) return null;
    return JSON.parse(decode.payload);
  } catch {
    return null;
  }
}

module.exports = { creerTokenInterne, verifierTokenInterne };
