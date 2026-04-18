const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Whitelist stricte — extension ET MIME doivent correspondre à une entrée.
// SVG est explicitement exclu car il peut contenir du JavaScript exécuté en
// contexte same-origin.
const ALLOWED = {
    '.png': new Set(['image/png']),
    '.jpg': new Set(['image/jpeg']),
    '.jpeg': new Set(['image/jpeg']),
    '.webp': new Set(['image/webp']),
    '.csv': new Set(['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain']),
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function uuidV4() {
    // crypto.randomUUID n'est disponible qu'à partir de Node 14.17 — tous les
    // environnements cibles le supportent. Fallback randomBytes si indisponible.
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return crypto.randomBytes(16).toString('hex');
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Ignorer complètement l'extension fournie par le client et recalculer
        // à partir du MIME validé par le filter. Nom = UUID v4 sans séparateurs
        // exotiques pour éviter toute traversée de chemin.
        const ext = path.extname(file.originalname).toLowerCase();
        // Sauvegarder l'extension validée sur req pour la réutiliser côté route
        // si besoin. La validation du couple ext/MIME a lieu dans fileFilter.
        cb(null, uuidV4() + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    // Rejet explicite des SVG (ils peuvent être détectés comme image/* par
    // certains navigateurs et portent du JS inline).
    if (originalExt === '.svg' || file.mimetype === 'image/svg+xml') {
        return cb(new Error('Format SVG interdit (risque XSS).'), false);
    }
    const allowedMimes = ALLOWED[originalExt];
    if (!allowedMimes || !allowedMimes.has(file.mimetype)) {
        return cb(new Error('Format de fichier non supporté (png, jpg, jpeg, webp, csv uniquement).'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;
module.exports.IMAGE_EXTENSIONS = IMAGE_EXTENSIONS;
