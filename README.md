# Eval Node.js – Auth + Data services

Projet d'examen : auth JWT maison, rate limit, proof of work, rotation, double pepper.

## Lancer

```bash
# Terminal 1
cd auth-service && node index.js

# Terminal 2  
cd data-service && node index.js
```

auth-service : port 3000  
data-service : port 3001

Créer un fichier `.env` à la racine avec : `CLE_SECRETE`, `POIVRE_PRINCIPAL`, `POIVRE_SECONDAIRE`.

---

## Tester

### Option 1 : script automatique

```bash
node test-auth.js
```

Le script fait login, calcule le nonce, appelle /protected et /secure-data.

### Option 2 : curl manuel

**1. Login**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{}"
```

Réponse : `{"token":"eyJ..."}`. Copier le token.

**2. Calculer le nonce**

Le PoW exige `SHA256(token + nonce)` qui commence par `0000`. Pour trouver un nonce valide :

```bash
node -e "const c=require('crypto');const t='VOTRE_TOKEN';let n=0;while(!c.createHash('sha256').update(t+n).digest('hex').startsWith('0000'))n++;console.log(n);"
```

Remplacer `VOTRE_TOKEN` par le token (entre guillemets).

**3. Routes protégées**

Headers requis :
- `Authorization: Bearer <token>`
- `X-POW-Nonce: <nonce>`

```bash
# GET /protected
curl -X GET http://localhost:3000/protected \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "X-POW-Nonce: NONCE_TROUVE"

# POST /auth/rotate (retourne un nouveau token)
curl -X POST http://localhost:3000/auth/rotate \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "X-POW-Nonce: NONCE_TROUVE" \
  -H "Content-Type: application/json"

# GET /secure-data (appelle data-service)
curl -X GET http://localhost:3000/secure-data \
  -H "Authorization: Bearer VOTRE_TOKEN" \
  -H "X-POW-Nonce: NONCE_TROUVE"
```

**4. Tester la rotation**

Après un rotate réussi, l’ancien token est révoqué. Réutiliser le même token → 401.

**5. Tester le rate limit**

Envoyer 11 requêtes en 30 s sur /protected avec le même token → la 11e renvoie 429.

---

## Répartition du travail

### Eddy
- **jwt_maison.js** – Création et vérification des JWT (Partie 1)
- **authMiddleware.js** – Vérif token + blacklist
- **blacklist.js** – Blacklist persistante (Partie 4 + bonus)

### Brad
- **rateLimiter.js** – Rate limit par jti, 10 req/30s (Partie 2)

### Simone
- **pOW.js** – Proof of work, SHA256 token+nonce (Partie 3)

### Commun
- **index.js** (auth-service) – Routes, orchestration
- **data-service/** – Microservice, tokens internes (Parties 5 & 6)
- **middlewareErreur.js** – Gestion des erreurs
