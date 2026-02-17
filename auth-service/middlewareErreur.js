// catch toutes les erreurs non gérées
function gestionnaireErreur(err, req, res, next) {
  console.error('Erreur:', err.message);

  const statut = err.statut || 500; // défaut 500
  const message = err.statut ? err.message : 'Erreur interne du serveur';

  res.status(statut).json({
    erreur: message
  });
}

module.exports = gestionnaireErreur;
