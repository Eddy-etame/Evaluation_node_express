# Guide complet du projet – Authentification Node.js/Express

Ce document explique tout le projet du début à la fin, comme si vous découvriez le code pour la première fois.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Structure du projet](#2-structure-du-projet)
3. [Le fichier .env](#3-le-fichier-env)
4. [auth-service – Service principal](#4-auth-service--service-principal)
5. [JWT maison](#5-jwt-maison)
6. [Rate limiter](#6-rate-limiter)
7. [Proof of Work](#7-proof-of-work)
8. [Blacklist persistante](#8-blacklist-persistante)
9. [Gestion des erreurs](#9-gestion-des-erreurs)
10. [data-service – Microservice](#10-data-service--microservice)
11. [Flux complet d'une requête](#11-flux-complet-dune-requête)

---

## 1. Vue d'ensemble

### Qu'est-ce qu'on a construit ?

Un système d'authentification sécurisé avec :
- **auth-service** : service principal qui gère login, tokens, rotation
- **data-service** : microservice qui protège des données et n'accepte que des tokens internes

### Pourquoi deux services ?

Pour le **double pepper** : on utilise deux secrets différents (poivres) pour séparer les tokens utilisateurs des tokens internes. Le data-service ne fait confiance qu'aux tokens signés avec son propre pepper.

---

## 2. Structure du projet

```
Eval_JS/
├── .env                    # Secrets (clé, poivres)
├── auth-service/
│   ├── index.js            # Point d'entrée, routes
│   ├── jwt_maison.js       # Création et vérification des JWT
│   ├── authMiddleware.js   # Vérifie le token sur chaque requête protégée
│   ├── rateLimiter.js      # Limite les requêtes par token
│   ├── pOW.js              # Proof of Work
│   ├── blacklist.js        # Tokens révoqués (persistant)
│   ├── middlewareErreur.js # Gestion centralisée des erreurs
│   └── data/
│       └── blacklist.json  # Fichier de sauvegarde (créé automatiquement)
└── data-service/
    ├── index.js            # Point d'entrée
    └── authInterne.js      # Tokens internes (autre pepper)
```

---

## 3. Le fichier .env

### Où est-il ?

À la racine du projet : `Eval_JS/.env`

### Contenu

```
CLE_SECRETE=secret-simone-eddy-brad-evaluation
POIVRE_PRINCIPAL=poivre-principal-eddy-simone-brad-evaluation
POIVRE_SECONDAIRE=poivre-secondaire-pour-tokens-internes
```

### À quoi sert chaque variable ?

| Variable | Utilisée par | Rôle |
|----------|--------------|------|
| **CLE_SECRETE** | auth-service et data-service | Secret partagé, base de toutes les signatures |
| **POIVRE_PRINCIPAL** | auth-service | Ajouté à la clé pour signer les tokens **utilisateurs** (login, rotate) |
| **POIVRE_SECONDAIRE** | data-service | Ajouté à la clé pour signer les tokens **internes** (appels entre services) |

### Pourquoi deux poivres ?

- Tokens utilisateurs : `CLE_SECRETE + POIVRE_PRINCIPAL`
- Tokens internes : `CLE_SECRETE + POIVRE_SECONDAIRE`

Si quelqu'un vole un token utilisateur, il ne peut pas l'utiliser pour appeler le data-service, car ce dernier vérifie uniquement les tokens internes.

### Comment le .env est-il chargé ?

Au tout début de `auth-service/index.js` et `data-service/index.js` :

```javascript
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
```

- `dotenv` lit le fichier `.env` et remplit `process.env`
- `__dirname` = dossier du fichier actuel (ex: `auth-service`)
- `'..'` = dossier parent = racine du projet
- Donc on charge `Eval_JS/.env`

---

## 4. auth-service – Service principal

### Point d'entrée : index.js

```javascript
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
// ... autres requires
```

**Pourquoi charger dotenv en premier ?** Pour que `process.env` soit rempli avant tout autre code qui lit les variables d'environnement.

```javascript
const CLE_SECRETE = process.env.CLE_SECRETE || 'secret-par-defaut';
const POIVRE_PRINCIPAL = process.env.POIVRE_PRINCIPAL || 'poivre-principal';
const SECRET_JWT = CLE_SECRETE + POIVRE_PRINCIPAL;

app.locals.SECRET_JWT = SECRET_JWT;
```

- `app.locals` : stockage accessible dans tous les middlewares via `req.app.locals`
- On y met `SECRET_JWT` pour que `authMiddleware` puisse vérifier les tokens sans le passer en paramètre partout

### Routes

| Méthode | Route | Protégée ? | Description |
|---------|-------|------------|-------------|
| POST | /auth/login | Non | Retourne un token |
| POST | /auth/rotate | Oui | Invalide l'ancien token, retourne un nouveau |
| GET | /protected | Oui | Route de test protégée |
| GET | /secure-data | Oui | Appelle le data-service et retourne sa réponse |

---

## 5. JWT maison

### Fichier : jwt_maison.js

Un JWT (JSON Web Token) a 3 parties séparées par des points :

```
base64(header).base64(payload).signature
```

### Création d'un token

```javascript
function creerToken(payload, secret) {
  const enTete = { alg: 'HS256', typ: 'JWT' };
  const enTeteB64 = encoderBase64Url(JSON.stringify(enTete));
  const payloadB64 = encoderBase64Url(JSON.stringify(payload));
  const signature = signer(`${enTeteB64}.${payloadB64}`, secret);
  return `${enTeteB64}.${payloadB64}.${signature}`;
}
```

- **header** : algorithme (HS256) et type (JWT)
- **payload** : données (sub, iat, exp, jti)
- **signature** : HMAC-SHA256 de `header.payload` avec le secret

### Base64URL

Le JWT utilise Base64URL, pas le Base64 classique :
- `+` → `-`
- `/` → `_`
- suppression du `=` de padding

Pour éviter les problèmes dans les URLs et les en-têtes HTTP.

### Vérification

```javascript
if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(signatureAttendue))) return null;
```

**Pourquoi `timingSafeEqual` ?** Une comparaison avec `===` peut fuiter des informations via le temps d'exécution (timing attack). `timingSafeEqual` prend toujours le même temps, quelle que soit la différence entre les chaînes.

---

## 6. Rate limiter

### Fichier : rateLimiter.js (fait par Brad)

**Objectif :** Limiter à 10 requêtes par 30 secondes, **par token** (jti), pas par IP.

```javascript
const carteLimite = new Map();
let enregistrement = carteLimite.get(jti);
```

**Pourquoi une Map ?** Chaque `jti` (identifiant unique du token) est une clé. La valeur est un objet `{ compteur, debutFenetre }`.

**Logique :**
1. Première requête pour ce jti → créer un enregistrement, compteur = 1
2. Requêtes suivantes dans les 30 s → incrémenter le compteur
3. Si compteur > 10 → HTTP 429
4. Si plus de 30 s depuis le début → réinitialiser la fenêtre

---

## 7. Proof of Work

### Fichier : pOW.js (fait par Simone)

**Objectif :** Le client doit prouver qu'il a fait un calcul (SHA256) pour éviter les abus.

```javascript
const hash = crypto.createHash('sha256').update(token + nonce).digest('hex');
if (!hash.startsWith(PREFIXE_ZEROS)) {
  return res.status(403).json({ erreur: 'Preuve de travail invalide' });
}
```

- Le client envoie un **nonce** dans l'en-tête `X-POW-Nonce`
- Le serveur calcule `SHA256(token + nonce)`
- Si le hash ne commence pas par `"0000"` → HTTP 403

**Pourquoi `req.token` et pas `req.headers["authorization"]` ?** L'en-tête contient `"Bearer eyJ..."`. Le JWT brut (sans "Bearer ") est dans `req.token`, défini par `authMiddleware`. L'examen demande `SHA256(token + nonce)` avec le token brut.

---

## 8. Blacklist persistante

### Fichier : blacklist.js

**Objectif :** Quand un token est utilisé pour une rotation, son `jti` doit être invalidé. Et cette liste doit survivre au redémarrage du serveur.

```javascript
const FICHIER_BLACKLIST = path.join(__dirname, 'data', 'blacklist.json');

function chargerBlacklist() {
  try {
    const contenu = fs.readFileSync(FICHIER_BLACKLIST, 'utf8');
    return new Set(JSON.parse(contenu));
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();  // Fichier n'existe pas encore
    throw err;
  }
}

function sauvegarderBlacklist(jtis) {
  const dossier = path.dirname(FICHIER_BLACKLIST);
  if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(FICHIER_BLACKLIST, JSON.stringify([...jtis], null, 2), 'utf8');
}
```

- **Au démarrage** : on charge le fichier (ou un Set vide si le fichier n'existe pas)
- **À chaque invalidation** : on ajoute le jti au Set et on sauvegarde le fichier

---

## 9. Gestion des erreurs

### Fichier : middlewareErreur.js

**Objectif :** Une seule fonction qui reçoit toutes les erreurs non gérées et renvoie une réponse JSON cohérente.

```javascript
function gestionnaireErreur(err, req, res, next) {
  console.error('Erreur:', err.message);
  const statut = err.statut || 500;
  const message = err.statut ? err.message : 'Erreur interne du serveur';
  res.status(statut).json({ erreur: message });
}
```

**Utilisation dans un route async :**

```javascript
app.get('/secure-data', ..., async (req, res, next) => {
  try {
    const reponse = await fetch('http://localhost:3001/internal/data', ...);
    if (!reponse.ok) {
      const err = new Error('Service de données indisponible');
      err.statut = 503;
      throw err;
    }
    // ...
  } catch (err) {
    next(err);  // Passe l'erreur au middleware d'erreur
  }
});

app.use(gestionnaireErreur);  // Doit être après les routes
```

---

## 10. data-service – Microservice

### Fichier : authInterne.js

Les tokens internes ne sont pas des JWT. Format : `base64({ payload, sig })` où `sig` = HMAC-SHA256 du payload avec `CLE_SECRETE + POIVRE_SECONDAIRE`.

```javascript
const SECRET_INTERNE = CLE_SECRETE + POIVRE_SECONDAIRE;

function creerTokenInterne(payload) {
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET_INTERNE).update(payloadStr).digest('hex');
  return Buffer.from(JSON.stringify({ payload: payloadStr, sig: signature })).toString('base64');
}
```

Le data-service **refuse** les tokens utilisateurs. Il ne vérifie que les tokens internes.

### Route GET /internal/data

- Vérifie l'en-tête `X-INTERNAL-TOKEN`
- Si valide → retourne `{ secure: true }`
- Sinon → retourne 401

---

## 11. Flux complet d'une requête

### Exemple : GET /secure-data

1. **authMiddleware** : Vérifie le token utilisateur (signature, expiration, blacklist). Met `req.payload`, `req.jti`, `req.token`.
2. **limiteurDeRequetes** : Vérifie qu'on n'a pas dépassé 10 requêtes en 30 s pour ce jti.
3. **proofOfWork** : Vérifie que `SHA256(token + nonce)` commence par "0000".
4. **Route** : Crée un token interne, appelle le data-service, retourne la réponse.
5. Si une erreur est levée → **gestionnaireErreur** renvoie une réponse JSON cohérente.

---

## Ordre des middlewares (examen)

1. Vérification signature (dans authMiddleware)
2. Vérification expiration (dans verifierToken)
3. Rate limit
4. Proof of Work
5. Accès à la route

---

## Lancement

```bash
# Terminal 1
cd auth-service && node index.js

# Terminal 2
cd data-service && node index.js
```

Le auth-service écoute sur le port 3000, le data-service sur le port 3001.
