function notFound(res, message = 'Ressource introuvable') {
    return res.status(404).json({ success: false, error: message });
}

function badRequest(res, message = 'Requête invalide') {
    return res.status(400).json({ success: false, error: message });
}

function unauthorized(res, message = 'Non authentifié') {
    return res.status(401).json({ success: false, error: message });
}

function forbidden(res, message = 'Non autorisé') {
    return res.status(403).json({ success: false, error: message });
}

function internalError(res, message = 'Erreur interne du serveur') {
    return res.status(500).json({ success: false, error: message });
}

module.exports = { notFound, badRequest, unauthorized, forbidden, internalError };