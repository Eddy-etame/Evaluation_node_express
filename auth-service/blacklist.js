// fait par eddy
// jti révoqués, sauvegardés dans data/blacklist.json
const fs = require('fs');
const path = require('path');

const FICHIER_BLACKLIST = path.join(__dirname, 'data', 'blacklist.json');

function chargerBlacklist() {
  try {
    const contenu = fs.readFileSync(FICHIER_BLACKLIST, 'utf8');
    return new Set(JSON.parse(contenu));
  } catch (err) {
    if (err.code === 'ENOENT') return new Set(); // fichier pas encore créé
    throw err;
  }
}

function sauvegarderBlacklist(jtis) {
  const dossier = path.dirname(FICHIER_BLACKLIST);
  if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(FICHIER_BLACKLIST, JSON.stringify([...jtis], null, 2), 'utf8');
}

let jtisInvalides = chargerBlacklist();

function invalider(jti) {
  jtisInvalides.add(jti);
  sauvegarderBlacklist(jtisInvalides);
}

function estInvalide(jti) {
  return jtisInvalides.has(jti);
}

module.exports = { invalider, estInvalide };
