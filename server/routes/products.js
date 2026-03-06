const express = require('express');
const router = express.Router();
const { asyncHandler, authMiddleware, adminOnly } = require('../middleware');
const { queryAll, queryOne, run, logAudit } = require('../db');
const v = require('../validators');
const fs = require('fs');
const csv = require('csv-parser');

router.get('/', authMiddleware, asyncHandler((req, res) => {
    const { categorie_id, search, all } = req.query;
    let query = `SELECT p.*, c.nom as categorie_nom, c.couleur as categorie_couleur, 
                 t.nom as taxe_nom, t.taux as taux_tva,
                 COALESCE(s.quantite, 0) as stock_quantite, COALESCE(s.seuil_alerte, 5) as stock_seuil,
                 p.prix_gros, p.prix_semi_gros
                 FROM produits p 
                 LEFT JOIN categories c ON p.categorie_id = c.id 
                 LEFT JOIN taxes t ON p.taxe_id = t.id
                 LEFT JOIN stock s ON s.produit_id = p.id AND s.succursale_id = ? `;
    const params = [req.user.succursale_id || 1];
    if (!all) {
        query += ' WHERE p.actif = 1';
    } else {
        query += ' WHERE 1=1';
    }
    if (categorie_id) { query += ' AND p.categorie_id = ?'; params.push(parseInt(categorie_id)); }
    if (search) { query += ' AND p.nom LIKE ?'; params.push(`%${search}%`); }
    query += ' ORDER BY c.ordre, p.nom';
    res.json(queryAll(query, params));
}));

// Lookup produit par code-barres (scan)
router.get('/code-barre/:code', authMiddleware, asyncHandler((req, res) => {
    const code = req.params.code.trim();
    if (!code) return res.status(400).json({ error: 'Code-barres requis' });
    const produit = queryOne(
        `SELECT p.*, c.nom as categorie_nom, c.couleur as categorie_couleur,
        t.nom as taxe_nom, t.taux as taux_tva,
        COALESCE(s.quantite, 0) as stock_quantite,
        p.prix_gros, p.prix_semi_gros
     FROM produits p
     LEFT JOIN categories c ON p.categorie_id = c.id
     LEFT JOIN taxes t ON p.taxe_id = t.id
     LEFT JOIN stock s ON s.produit_id = p.id AND s.succursale_id = ?
        WHERE p.code_barre = ? AND p.actif = 1`,
        [req.user.succursale_id || 1, code]
    );
    if (!produit) return res.status(404).json({ error: 'Produit non trouvé pour ce code-barres' });
    res.json(produit);
}));

// Produits proches de la DLC
router.get('/dlc/alertes', authMiddleware, asyncHandler((req, res) => {
    const jours = parseInt(req.query.jours) || 7;
    const alertes = queryAll(
        `SELECT p.*, c.nom as categorie_nom,
        julianday(p.dlc) - julianday('now') as jours_restants
     FROM produits p
     LEFT JOIN categories c ON p.categorie_id = c.id
     WHERE p.dlc IS NOT NULL AND p.dlc != '' AND p.actif = 1
     AND julianday(p.dlc) - julianday('now') <= ?
        ORDER BY p.dlc ASC`,
        [jours]
    );
    res.json(alertes);
}));

const upload = require('../middleware/upload');

router.post('/import', authMiddleware, adminOnly, upload.single('csv'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis' });

    const results = [];
    const erreurs = [];
    let countSuccess = 0;

    fs.createReadStream(req.file.path)
        .pipe(csv({ separator: ';' })) // Le standard Excel français exporte en point-virgule
        .on('data', (data) => {
            // Trim les entêtes au cas où (par ex: " nom ")
            const row = {};
            for (let key in data) row[key.trim().toLowerCase()] = data[key] ? data[key].trim() : '';
            results.push(row);
        })
        .on('end', async () => {
            try {
                // On met l'insertion dans une transaction manuelle ou boucle
                // On précharge les catégories pour correspondre par le nom
                const categories = queryAll('SELECT id, nom FROM categories');
                const catMap = {};
                categories.forEach(c => catMap[c.nom.toLowerCase()] = c.id);

                for (let i = 0; i < results.length; i++) {
                    const row = results[i];
                    if (!row.nom) { erreurs.push(`Ligne ${i + 2}: Nom produit manquant`); continue; }

                    const prix_ttc = parseFloat(row.prix_ttc ? row.prix_ttc.replace(',', '.') : 0);
                    if (isNaN(prix_ttc) || prix_ttc <= 0) { erreurs.push(`Ligne ${i + 2}: Prix TTC invalide pour "${row.nom}"`); continue; }

                    const prix_ht = +(prix_ttc / 1.2).toFixed(2); // On force TVA 20 par défaut si non précisée
                    const code = row.code_barre || '';
                    const stock = parseInt(row.stock || 0);

                    // Chercher ou créer catégorie si fournie
                    let catId = null;
                    if (row.categorie) {
                        const cnom = row.categorie.toLowerCase();
                        if (catMap[cnom]) {
                            catId = catMap[cnom];
                        } else {
                            // On crée la catégorie
                            const insertCat = run("INSERT INTO categories (nom, icone, couleur, ordre) VALUES (?, '📦', '#95a5a6', 99)", [row.categorie]);
                            catId = insertCat.lastInsertRowid;
                            catMap[cnom] = catId;
                        }
                    }

                    // Insertion Produit
                    try {
                        let productId;
                        // Vérifier si code-barres existe déjà pour mettre à jour ou ignorer ? (On va créer pour le moment, sauf si code-barres exact)
                        const exists = code ? queryOne('SELECT id FROM produits WHERE code_barre = ?', [code]) : null;

                        if (exists) {
                            run('UPDATE produits SET prix_ttc=?, prix_ht=?, categorie_id=? WHERE id=?', [prix_ttc, prix_ht, catId, exists.id]);
                            productId = exists.id;
                        } else {
                            const resProd = run(
                                'INSERT INTO produits (nom, prix_ht, prix_ttc, categorie_id, code_barre) VALUES (?,?,?,?,?)',
                                [row.nom, prix_ht, prix_ttc, catId, code]
                            );
                            productId = resProd.lastInsertRowid;
                            // Insert stock initial
                            run('INSERT INTO stock (produit_id, succursale_id, quantite) VALUES (?, ?, ?)', [productId, 1, stock]);
                        }
                        countSuccess++;
                    } catch (e) {
                        erreurs.push(`Ligne ${i + 2}: Erreur interne (${e.message})`);
                    }
                }
            } catch (err) {
                erreurs.push(`Erreur générale: ${err.message}`);
            } finally {
                // Delete file
                try { fs.unlinkSync(req.file.path); } catch (e) { }
                logAudit(req.user.id, req.user.nom, 'IMPORT_CSV', 'produit', 0, `Import CSV: ${countSuccess} produits avec succès.`);
                res.json({ success: true, count: countSuccess, erreurs });
            }
        });
}));

router.post('/', authMiddleware, adminOnly, upload.single('image'), v.createProductRules, v.handleValidation, asyncHandler((req, res) => {
    const { nom, prix_ttc, categorie_id, taxe_id, description, code_barre, cout_revient, stock_initial, unite, poids_net, parent_id, variante_label, variante_attributs, prix_gros, prix_semi_gros } = req.body;
    let image = '';
    if (req.file) image = req.file.filename;

    if (!nom || !prix_ttc) return res.status(400).json({ error: 'Nom et prix requis' });
    // Calculer prix HT
    const taxe = queryOne('SELECT taux FROM taxes WHERE id = ?', [taxe_id || 1]);
    const taux = taxe ? taxe.taux : 0;
    const prixHt = +(prix_ttc / (1 + taux / 100)).toFixed(2);
    const result = run(
        'INSERT INTO produits (nom, prix_ht, prix_ttc, categorie_id, taxe_id, description, code_barre, cout_revient, unite, poids_net, parent_id, variante_label, variante_attributs, prix_gros, prix_semi_gros, image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
            nom, prixHt, prix_ttc, categorie_id || null, taxe_id || 1, description || '', code_barre || '', cout_revient || 0,
            unite || 'piece', poids_net || 0, parent_id || null, variante_label || '', variante_attributs || '{}',
            parseFloat(prix_gros) || 0, parseFloat(prix_semi_gros) || 0, image
        ]
    );
    // Créer stock initial
    run('INSERT INTO stock (produit_id, succursale_id, quantite, seuil_alerte) VALUES (?, ?, ?, 10)',
        [result.lastInsertRowid, req.user.succursale_id || 1, stock_initial || 0]);
    logAudit(req.user.id, req.user.nom, 'CREATION', 'produit', result.lastInsertRowid, `Produit "${nom}" créé à ${prix_ttc} DH`);
    res.json({ id: result.lastInsertRowid, success: true });
}));

router.put('/:id', authMiddleware, adminOnly, upload.single('image'), v.updateProductRules, v.handleValidation, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    const { nom, prix_ttc, categorie_id, taxe_id, description, code_barre, cout_revient, actif, unite, poids_net, parent_id, variante_label, variante_attributs, prix_gros, prix_semi_gros, est_favori } = req.body;

    let fields = [];
    let params = [];

    // Helper to add field if present
    const add = (col, val) => {
        if (val !== undefined) {
            fields.push(`${col} =? `);
            params.push(val);
        }
    };

    add('nom', nom);
    if (prix_ttc !== undefined) {
        // Recalculate HT if Price or Tax provided (or fallback to existing tax if not provided? simple approach: expect tax_id if price changes, or fetch existing)
        // Ideally we should fetch existing product if partial update on price but no tax provided.
        // For simplicity here, if prix_ttc provided, we recalc prix_ht based on provided or default tax
        // BUT strict partial update is safer.
        // Let's assume if price changes, tax might change or stay same.
        // We'll fetch current tax_id if not provided to be accurate, OR just use provided tax_id || 1 (fallback risk).
        // Let's use provided tax_id or 1 for now as per original code, but cleaner:
        const tId = taxe_id !== undefined ? taxe_id : 1; // This defaults to 1 if undefined, which is risky for partial update!
        // BETTER: Fetch existing if undefined?
        // To be safe for "Toggle Active" (which sends ONLY actif), we should NOT touch price fields if not in body.

        // Logic: Only update price/ht if prix_ttc is in body.
        add('prix_ttc', prix_ttc);

        let tRate = 0;
        if (taxe_id !== undefined) {
            const t = queryOne('SELECT taux FROM taxes WHERE id = ?', [taxe_id]);
            tRate = t ? t.taux : 0;
            add('taxe_id', taxe_id);
        } else {
            // If tax not provided, we need it to calc HT? 
            // Or we just fetch the product's current tax to be precise?
            // Let's fetch current product to get its tax_id if strict accuracy needed.
            // OR simpler: just query tax 1 if not provided? No, that changes data.
            // Let's query the product first if we are updating price but no tax.
            const p = queryOne('SELECT taxe_id FROM produits WHERE id = ?', [id]);
            if (p) {
                const t = queryOne('SELECT taux FROM taxes WHERE id = ?', [p.taxe_id]);
                tRate = t ? t.taux : 0;
            }
        }

        const ht = +(prix_ttc / (1 + tRate / 100)).toFixed(2);
        add('prix_ht', ht);
    } else {
        // If price not updated, check if tax updated?
        if (taxe_id !== undefined) {
            add('taxe_id', taxe_id);
            // If tax changes, price HT changes (assuming TTC stays constant? or HT stays constant?)
            // Usually TTC is master. So if Tax changes, HT changes.
            // We need current TTC to recalc HT.
            const p = queryOne('SELECT prix_ttc FROM produits WHERE id = ?', [id]);
            if (p) {
                const t = queryOne('SELECT taux FROM taxes WHERE id = ?', [taxe_id]);
                const tRate = t ? t.taux : 0;
                const ht = +(p.prix_ttc / (1 + tRate / 100)).toFixed(2);
                add('prix_ht', ht);
            }
        }
    }

    add('categorie_id', categorie_id);
    add('description', description);
    add('code_barre', code_barre);
    add('cout_revient', cout_revient);
    add('actif', actif);
    add('unite', unite);
    add('poids_net', poids_net);
    add('parent_id', parent_id);
    add('variante_label', variante_label);
    add('variante_attributs', variante_attributs);
    add('prix_gros', prix_gros !== undefined ? parseFloat(prix_gros) : undefined);
    add('prix_semi_gros', prix_semi_gros !== undefined ? parseFloat(prix_semi_gros) : undefined);
    add('est_favori', est_favori);

    if (req.file) {
        add('image', req.file.filename);
    }

    if (fields.length === 0) return res.json({ success: true, message: 'Aucune modification' });

    params.push(id);
    const result = run(`UPDATE produits SET ${fields.join(', ')} WHERE id = ? `, params);

    // Log intent (requires fetching product for name if we want detailed log, but generic is fine)
    const logDetails = nom ? `Produit "${nom}" modifié` : `Produit #${id} modifié`;
    logAudit(req.user.id, req.user.nom, 'MODIFICATION', 'produit', id, logDetails);

    res.json({ success: true, changes: result.changes });
}));

router.delete('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
    const id = parseInt(req.params.id);
    // Check if used in orders? 
    // Ideally we just hide it (actif=0) but for a real DELETE:
    const count = queryOne('SELECT COUNT(*) as c FROM commande_lignes WHERE produit_id = ?', [id]);
    if (count && count.c > 0) {
        return res.status(400).json({ error: 'Ce produit ne peut pas être supprimé car il a été utilisé dans des commandes. Vous pouvez seulement le désactiver.' });
    }
    run('DELETE FROM stock WHERE produit_id = ?', [id]);
    run('DELETE FROM produits WHERE id = ?', [id]);
    logAudit(req.user.id, req.user.nom, 'SUPPRESSION', 'produit', id, `Produit #${id} supprimé`);
    res.json({ success: true });
}));

module.exports = router;
