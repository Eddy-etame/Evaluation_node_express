require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const { verifierTokenInterne } = require('./authInterne');

const app = express();
const PORT = 3001;

app.use(express.json());

// tokens internes uniquement, pas les tokens users
app.get('/internal/data', (req, res) => {
  const token = req.headers['x-internal-token'];
  if (!token) return res.status(401).json({ erreur: 'Token interne manquant' });
  const payload = verifierTokenInterne(token);
  if (!payload) return res.status(401).json({ erreur: 'Token interne invalide' });
  res.json({ secure: true });
});

app.listen(PORT, () => {
  console.log(`Service de données sur le port ${PORT}`);
});
