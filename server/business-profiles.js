/**
 * ═══════════════════════════════════════════════════════════════
 *  PROFILS MÉTIER — Café & Restaurant POS v5.0
 *  Chaque profil définit : famille, catégories, produits, taxes,
 *  features, thème visuel, types de commande, et paramètres ticket.
 *
 *  Familles disponibles : 'cafe' | 'restaurant'
 *  Seules ces deux familles sont exposées par getProfilesList().
 * ═══════════════════════════════════════════════════════════════
 */

/** Whitelist des profils autorisés */
const ALLOWED_PROFILE_IDS = ['cafe', 'cafe_classique', 'salon_the', 'restaurant', 'restaurant_service', 'fast_food'];

const PROFILES = {

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                    CAFÉ (générique)                       ║
  // ╚═══════════════════════════════════════════════════════════╝
  cafe: {
    id: 'cafe',
    famille: 'cafe',
    nom: 'Café',
    icone: '☕',
    description: 'Café, coffee shop — boissons chaudes & froides, pâtisseries, snacks',
    couleur_primaire: '#6F4E37',
    couleur_accent: '#D4A574',
    header_gradient: 'linear-gradient(135deg, #5C3D2E, #6F4E37)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Exonéré)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7%', taux: 7, par_defaut: 0 },
      { id: 3, nom: 'TVA 10% (Restauration)', taux: 10, par_defaut: 1 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Boissons Chaudes', couleur: '#8B4513', icone: '☕', ordre: 1 },
      { nom: 'Boissons Froides', couleur: '#3498db', icone: '🧊', ordre: 2 },
      { nom: 'Jus & Smoothies', couleur: '#f39c12', icone: '🍊', ordre: 3 },
      { nom: 'Pâtisseries', couleur: '#e74c3c', icone: '🍰', ordre: 4 },
      { nom: 'Viennoiseries', couleur: '#D4A574', icone: '🥐', ordre: 5 },
      { nom: 'Snacks & Sandwichs', couleur: '#27ae60', icone: '🥪', ordre: 6 },
      { nom: 'Glaces & Desserts', couleur: '#e91e63', icone: '🍨', ordre: 7 },
    ],

    produits: {
      'Boissons Chaudes': [
        { nom: 'Espresso', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Double Espresso', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Café Américain', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Café Latte', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Cappuccino', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Café Mocha', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Thé Vert', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Thé à la Menthe', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Chocolat Chaud', prix_ttc: 16, taxe_idx: 3 },
        { nom: 'Noss-Noss', prix_ttc: 10, taxe_idx: 3 },
      ],
      'Boissons Froides': [
        { nom: 'Iced Coffee', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Iced Latte', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Frappuccino', prix_ttc: 28, taxe_idx: 3 },
        { nom: 'Eau Minérale', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Eau Gazeuse', prix_ttc: 8, taxe_idx: 1 },
        { nom: 'Soda', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Ice Tea', prix_ttc: 14, taxe_idx: 3 },
      ],
      'Jus & Smoothies': [
        { nom: 'Jus d\'Orange Pressé', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Jus de Pomme', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Smoothie Fruits Rouges', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Smoothie Banane-Mangue', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Limonade Maison', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Milkshake Vanille', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Milkshake Chocolat', prix_ttc: 22, taxe_idx: 3 },
      ],
      'Pâtisseries': [
        { nom: 'Tarte aux Fruits', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Éclair au Chocolat', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Cheesecake', prix_ttc: 28, taxe_idx: 3 },
        { nom: 'Brownie', prix_ttc: 16, taxe_idx: 3 },
        { nom: 'Cookie', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Muffin', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Tiramisu', prix_ttc: 25, taxe_idx: 3 },
      ],
      'Viennoiseries': [
        { nom: 'Croissant', prix_ttc: 5, taxe_idx: 3 },
        { nom: 'Pain au Chocolat', prix_ttc: 6, taxe_idx: 3 },
        { nom: 'Chausson aux Pommes', prix_ttc: 8, taxe_idx: 3 },
        { nom: 'Brioche', prix_ttc: 7, taxe_idx: 3 },
        { nom: 'Pain aux Raisins', prix_ttc: 7, taxe_idx: 3 },
      ],
      'Snacks & Sandwichs': [
        { nom: 'Sandwich Club', prix_ttc: 30, taxe_idx: 3 },
        { nom: 'Croque Monsieur', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Panini Poulet', prix_ttc: 28, taxe_idx: 3 },
        { nom: 'Quiche Lorraine', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Salade César', prix_ttc: 32, taxe_idx: 3 },
        { nom: 'Wrap Végétarien', prix_ttc: 25, taxe_idx: 3 },
      ],
      'Glaces & Desserts': [
        { nom: 'Glace 1 Boule', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Glace 2 Boules', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Crème Brûlée', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Panna Cotta', prix_ttc: 18, taxe_idx: 3 },
      ],
    },

    features: {
      tables: false,
      kds: false,
      code_barres: false,
      livraison: false,
      emporter: true,
      sur_place: true,
      fidelite: true,
      pourboire: true,
    },

    types_commande: ['sur_place', 'emporter'],

    ticket_defaults: {
      ticket_show_logo: '1',
      ticket_show_adresse: '1',
      ticket_show_telephone: '1',
      ticket_show_ice: '1',
      ticket_show_caissier: '1',
      ticket_show_articles: '1',
      ticket_show_tva_detail: '0',
      ticket_show_ht: '0',
      ticket_show_monnaie: '1',
      ticket_show_points: '1',
      ticket_show_client: '1',
      ticket_show_type_cmd: '1',
      ticket_show_header: '1',
      ticket_show_footer: '1',
      ticket_show_date_heure: '1',
      ticket_show_numero: '1',
      ticket_show_mode_paiement: '1',
      ticket_show_remise: '1',
      ticket_font_size: '13',
      ticket_largeur: '300',
      ticket_message_promo: '',
    },

    parametres_defaults: {
      devise: 'DH',
      tva_defaut: '10',
      points_par_dh: '1',
      seuil_points_cadeau: '500',
      ticket_footer: 'Merci et à bientôt ! ☕',
      ticket_header: '',
      auto_backup: '1',
    },
  },



  // ╔═══════════════════════════════════════════════════════════╗
  // ║                    CAFÉ CLASSIQUE                         ║
  // ╚═══════════════════════════════════════════════════════════╝
  cafe_classique: {
    id: 'cafe_classique',
    famille: 'cafe',
    nom: 'Café Classique',
    icone: '🫖',
    description: 'Café traditionnel marocain — boissons chaudes, thés, jus, snacks légers',
    couleur_primaire: '#4a2c17',
    couleur_accent: '#c8962e',
    header_gradient: 'linear-gradient(135deg, #3a1f0e, #4a2c17)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Exonéré)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7%', taux: 7, par_defaut: 0 },
      { id: 3, nom: 'TVA 10% (Restauration)', taux: 10, par_defaut: 1 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Boissons Chaudes', couleur: '#8B4513', icone: '☕', ordre: 1 },
      { nom: 'Thés & Tisanes', couleur: '#2ecc71', icone: '🫖', ordre: 2 },
      { nom: 'Jus Frais', couleur: '#f39c12', icone: '🍊', ordre: 3 },
      { nom: 'Boissons Froides', couleur: '#3498db', icone: '🧃', ordre: 4 },
      { nom: 'Snacks & Viennoiseries', couleur: '#D4A574', icone: '🥐', ordre: 5 },
    ],

    produits: {
      'Boissons Chaudes': [
        { nom: 'Espresso', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Café Noir', prix_ttc: 8, taxe_idx: 3 },
        { nom: 'Noss-Noss', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Café au Lait', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Cappuccino', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Chocolat Chaud', prix_ttc: 16, taxe_idx: 3 },
      ],
      'Thés & Tisanes': [
        { nom: 'Thé à la Menthe', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Thé Vert Nature', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Thé Verveine', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Thé Cannelle', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Infusion Camomille', prix_ttc: 12, taxe_idx: 3 },
      ],
      'Jus Frais': [
        { nom: 'Jus d\'Orange Pressé', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Jus de Grenade', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Jus de Carotte', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Limonade Maison', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Cocktail Fruits', prix_ttc: 20, taxe_idx: 3 },
      ],
      'Boissons Froides': [
        { nom: 'Eau Minérale', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Eau Gazeuse', prix_ttc: 8, taxe_idx: 1 },
        { nom: 'Soda Canette', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Ice Tea', prix_ttc: 12, taxe_idx: 3 },
      ],
      'Snacks & Viennoiseries': [
        { nom: 'Croissant', prix_ttc: 5, taxe_idx: 3 },
        { nom: 'Pain au Chocolat', prix_ttc: 6, taxe_idx: 3 },
        { nom: 'Msemen', prix_ttc: 5, taxe_idx: 3 },
        { nom: 'Beghrir', prix_ttc: 6, taxe_idx: 3 },
        { nom: 'Sandwich Fromage', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Cookie', prix_ttc: 8, taxe_idx: 3 },
      ],
    },

    features: {
      tables: false,
      kds: false,
      code_barres: false,
      livraison: false,
      emporter: true,
      sur_place: true,
      fidelite: true,
      pourboire: false,
    },

    types_commande: ['sur_place', 'emporter'],

    ticket_defaults: {
      ticket_show_logo: '1', ticket_show_adresse: '1', ticket_show_telephone: '1',
      ticket_show_ice: '1', ticket_show_caissier: '1', ticket_show_articles: '1',
      ticket_show_tva_detail: '0', ticket_show_ht: '0', ticket_show_monnaie: '1',
      ticket_show_points: '1', ticket_show_client: '1', ticket_show_type_cmd: '0',
      ticket_show_header: '1', ticket_show_footer: '1', ticket_show_date_heure: '1',
      ticket_show_numero: '1', ticket_show_mode_paiement: '1', ticket_show_remise: '1',
      ticket_font_size: '13', ticket_largeur: '300', ticket_message_promo: '',
    },

    parametres_defaults: {
      devise: 'DH', tva_defaut: '10', points_par_dh: '1',
      seuil_points_cadeau: '500', ticket_footer: 'شكرا على زيارتكم ☕',
      ticket_header: '', auto_backup: '1',
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                    SALON DE THÉ                           ║
  // ╚═══════════════════════════════════════════════════════════╝
  salon_the: {
    id: 'salon_the',
    famille: 'cafe',
    nom: 'Salon de Thé',
    icone: '🍵',
    description: 'Salon de thé — thés, infusions, pâtisseries orientales & françaises',
    couleur_primaire: '#2d5a27',
    couleur_accent: '#7cb97a',
    header_gradient: 'linear-gradient(135deg, #1e3d1a, #2d5a27)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Exonéré)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7%', taux: 7, par_defaut: 0 },
      { id: 3, nom: 'TVA 10% (Restauration)', taux: 10, par_defaut: 1 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Thés & Infusions', couleur: '#2d5a27', icone: '🍵', ordre: 1 },
      { nom: 'Boissons Chaudes', couleur: '#8B4513', icone: '☕', ordre: 2 },
      { nom: 'Pâtisseries Orientales', couleur: '#e74c3c', icone: '🧆', ordre: 3 },
      { nom: 'Pâtisseries Françaises', couleur: '#D4A574', icone: '🍰', ordre: 4 },
      { nom: 'Boissons Froides', couleur: '#3498db', icone: '🧊', ordre: 5 },
    ],

    produits: {
      'Thés & Infusions': [
        { nom: 'Thé à la Menthe', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Thé Vert Gunpowder', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Thé Chaïbi', prix_ttc: 16, taxe_idx: 3 },
        { nom: 'Thé Louiza', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Tisane Romarin', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Thé Oolong', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Infusion Hibiscus', prix_ttc: 14, taxe_idx: 3 },
      ],
      'Boissons Chaudes': [
        { nom: 'Espresso', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Cappuccino', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Chocolat Chaud', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Latte Vanille', prix_ttc: 22, taxe_idx: 3 },
      ],
      'Pâtisseries Orientales': [
        { nom: 'Corne de Gazelle', prix_ttc: 8, taxe_idx: 3 },
        { nom: 'Briouate aux Amandes', prix_ttc: 8, taxe_idx: 3 },
        { nom: 'Chebakia', prix_ttc: 6, taxe_idx: 3 },
        { nom: 'Ghriba', prix_ttc: 6, taxe_idx: 3 },
        { nom: 'Sellou (portion)', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Plateau Oriental (6p)', prix_ttc: 45, taxe_idx: 3 },
      ],
      'Pâtisseries Françaises': [
        { nom: 'Éclair au Chocolat', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Millefeuille', prix_ttc: 16, taxe_idx: 3 },
        { nom: 'Tarte Citron', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Macaron (pièce)', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Cheesecake', prix_ttc: 28, taxe_idx: 3 },
      ],
      'Boissons Froides': [
        { nom: 'Eau Minérale', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Jus d\'Orange', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Limonade', prix_ttc: 16, taxe_idx: 3 },
      ],
    },

    features: {
      tables: true,
      kds: false,
      code_barres: false,
      livraison: false,
      emporter: true,
      sur_place: true,
      fidelite: true,
      pourboire: false,
    },

    types_commande: ['sur_place', 'emporter'],

    ticket_defaults: {
      ticket_show_logo: '1', ticket_show_adresse: '1', ticket_show_telephone: '1',
      ticket_show_ice: '1', ticket_show_caissier: '1', ticket_show_articles: '1',
      ticket_show_tva_detail: '0', ticket_show_ht: '0', ticket_show_monnaie: '1',
      ticket_show_points: '1', ticket_show_client: '1', ticket_show_type_cmd: '1',
      ticket_show_header: '1', ticket_show_footer: '1', ticket_show_date_heure: '1',
      ticket_show_numero: '1', ticket_show_mode_paiement: '1', ticket_show_remise: '1',
      ticket_font_size: '13', ticket_largeur: '300', ticket_message_promo: '',
    },

    parametres_defaults: {
      devise: 'DH', tva_defaut: '10', points_par_dh: '1',
      seuil_points_cadeau: '500', ticket_footer: 'Merci de votre visite 🍵',
      ticket_header: '', auto_backup: '1',
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║               RESTAURANT (générique)                      ║
  // ╚═══════════════════════════════════════════════════════════╝
  restaurant: {
    id: 'restaurant',
    famille: 'restaurant',
    nom: 'Restaurant',
    icone: '🍽️',
    description: 'Restaurant — service à table, gestion des couverts, KDS cuisine',
    couleur_primaire: '#c0392b',
    couleur_accent: '#e74c3c',
    header_gradient: 'linear-gradient(135deg, #922b21, #c0392b)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Exonéré)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7%', taux: 7, par_defaut: 0 },
      { id: 3, nom: 'TVA 10% (Restauration)', taux: 10, par_defaut: 1 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Entrées', couleur: '#2ecc71', icone: '🥗', ordre: 1 },
      { nom: 'Plats', couleur: '#e67e22', icone: '🥩', ordre: 2 },
      { nom: 'Grillades', couleur: '#c0392b', icone: '🔥', ordre: 3 },
      { nom: 'Poissons & Fruits de Mer', couleur: '#3498db', icone: '🐟', ordre: 4 },
      { nom: 'Pizzas', couleur: '#f39c12', icone: '🍕', ordre: 5 },
      { nom: 'Desserts', couleur: '#9b59b6', icone: '🍰', ordre: 6 },
      { nom: 'Boissons', couleur: '#1abc9c', icone: '🥤', ordre: 7 },
    ],

    produits: {
      'Entrées': [
        { nom: 'Soupe du Jour', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Salade César', prix_ttc: 40, taxe_idx: 3 },
        { nom: 'Crudités Maison', prix_ttc: 30, taxe_idx: 3 },
        { nom: 'Briouate Viande', prix_ttc: 35, taxe_idx: 3 },
        { nom: 'Harira', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Zaalouk', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Taktouka', prix_ttc: 18, taxe_idx: 3 },
      ],
      'Plats': [
        { nom: 'Tajine Poulet Citron', prix_ttc: 90, taxe_idx: 3 },
        { nom: 'Tajine Agneau Pruneaux', prix_ttc: 110, taxe_idx: 3 },
        { nom: 'Couscous Royal', prix_ttc: 120, taxe_idx: 3 },
        { nom: 'Couscous Légumes', prix_ttc: 85, taxe_idx: 3 },
        { nom: 'Pastilla Poulet', prix_ttc: 95, taxe_idx: 3 },
        { nom: 'Rfissa', prix_ttc: 100, taxe_idx: 3 },
        { nom: 'Mrouzia', prix_ttc: 115, taxe_idx: 3 },
      ],
      'Grillades': [
        { nom: 'Brochette Kefta (4p)', prix_ttc: 60, taxe_idx: 3 },
        { nom: 'Brochette Agneau (4p)', prix_ttc: 80, taxe_idx: 3 },
        { nom: 'Poulet Grillé 1/2', prix_ttc: 70, taxe_idx: 3 },
        { nom: 'Entrecôte 300g', prix_ttc: 130, taxe_idx: 3 },
        { nom: 'Côtelettes Agneau', prix_ttc: 110, taxe_idx: 3 },
      ],
      'Poissons & Fruits de Mer': [
        { nom: 'Crevettes Grillées', prix_ttc: 120, taxe_idx: 3 },
        { nom: 'Calamars Frits', prix_ttc: 80, taxe_idx: 3 },
        { nom: 'Poisson du Jour', prix_ttc: 100, taxe_idx: 3 },
        { nom: 'Tajine Poisson', prix_ttc: 90, taxe_idx: 3 },
      ],
      'Pizzas': [
        { nom: 'Pizza Margherita', prix_ttc: 60, taxe_idx: 3 },
        { nom: 'Pizza Poulet', prix_ttc: 70, taxe_idx: 3 },
        { nom: 'Pizza Mixte', prix_ttc: 80, taxe_idx: 3 },
        { nom: 'Pizza 4 Fromages', prix_ttc: 75, taxe_idx: 3 },
      ],
      'Desserts': [
        { nom: 'Crème Caramel', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Cornes de Gazelle', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Salade de Fruits', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Glace 2 Boules', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Tiramisu', prix_ttc: 30, taxe_idx: 3 },
      ],
      'Boissons': [
        { nom: 'Eau Minérale', prix_ttc: 8, taxe_idx: 1 },
        { nom: 'Eau Gazeuse', prix_ttc: 10, taxe_idx: 1 },
        { nom: 'Jus d\'Orange Pressé', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Soda Canette', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Café Espresso', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Thé à la Menthe', prix_ttc: 15, taxe_idx: 3 },
      ],
    },

    features: {
      tables: true,
      kds: true,
      code_barres: false,
      livraison: false,
      emporter: true,
      sur_place: true,
      fidelite: true,
      pourboire: true,
    },

    types_commande: ['sur_place', 'emporter'],

    ticket_defaults: {
      ticket_show_logo: '1', ticket_show_adresse: '1', ticket_show_telephone: '1',
      ticket_show_ice: '1', ticket_show_caissier: '1', ticket_show_articles: '1',
      ticket_show_tva_detail: '1', ticket_show_ht: '1', ticket_show_monnaie: '1',
      ticket_show_points: '1', ticket_show_client: '1', ticket_show_type_cmd: '1',
      ticket_show_header: '1', ticket_show_footer: '1', ticket_show_date_heure: '1',
      ticket_show_numero: '1', ticket_show_mode_paiement: '1', ticket_show_remise: '1',
      ticket_font_size: '13', ticket_largeur: '300', ticket_message_promo: '',
    },

    parametres_defaults: {
      devise: 'DH', tva_defaut: '10', points_par_dh: '1',
      seuil_points_cadeau: '500', ticket_footer: 'Merci de votre visite ! 🍽️',
      ticket_header: '', auto_backup: '1',
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║            RESTAURANT SERVICE TABLE                       ║
  // ╚═══════════════════════════════════════════════════════════╝
  restaurant_service: {
    id: 'restaurant_service',
    famille: 'restaurant',
    nom: 'Restaurant — Service Table',
    icone: '🪑',
    description: 'Restaurant gastronomique — addition par table, couverts, KDS, réservations',
    couleur_primaire: '#1a237e',
    couleur_accent: '#3949ab',
    header_gradient: 'linear-gradient(135deg, #0d1257, #1a237e)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Exonéré)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7%', taux: 7, par_defaut: 0 },
      { id: 3, nom: 'TVA 10% (Restauration)', taux: 10, par_defaut: 1 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Amuse-Bouches', couleur: '#f39c12', icone: '🫙', ordre: 1 },
      { nom: 'Entrées', couleur: '#2ecc71', icone: '🥗', ordre: 2 },
      { nom: 'Plats Principaux', couleur: '#e67e22', icone: '🥩', ordre: 3 },
      { nom: 'Desserts', couleur: '#9b59b6', icone: '🍮', ordre: 4 },
      { nom: 'Boissons', couleur: '#1abc9c', icone: '🥂', ordre: 5 },
      { nom: 'Menu Déjeuner', couleur: '#e74c3c', icone: '🍱', ordre: 6 },
    ],

    produits: {
      'Amuse-Bouches': [
        { nom: 'Amuse-Bouche Maison', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Pain & Beurre', prix_ttc: 10, taxe_idx: 3 },
      ],
      'Entrées': [
        { nom: 'Soupe du Jour', prix_ttc: 30, taxe_idx: 3 },
        { nom: 'Salade de Saison', prix_ttc: 45, taxe_idx: 3 },
        { nom: 'Foie Gras Maison', prix_ttc: 90, taxe_idx: 3 },
        { nom: 'Carpaccio', prix_ttc: 65, taxe_idx: 3 },
        { nom: 'Tartare Saumon', prix_ttc: 75, taxe_idx: 3 },
      ],
      'Plats Principaux': [
        { nom: 'Filet Mignon', prix_ttc: 180, taxe_idx: 3 },
        { nom: 'Tajine Royal', prix_ttc: 130, taxe_idx: 3 },
        { nom: 'Poisson du Marché', prix_ttc: 140, taxe_idx: 3 },
        { nom: 'Risotto Champignons', prix_ttc: 95, taxe_idx: 3 },
        { nom: 'Couscous Gala', prix_ttc: 150, taxe_idx: 3 },
      ],
      'Desserts': [
        { nom: 'Moelleux Chocolat', prix_ttc: 40, taxe_idx: 3 },
        { nom: 'Crème Brûlée', prix_ttc: 35, taxe_idx: 3 },
        { nom: 'Tarte Fine Pommes', prix_ttc: 38, taxe_idx: 3 },
        { nom: 'Assiette de Mignardises', prix_ttc: 45, taxe_idx: 3 },
      ],
      'Boissons': [
        { nom: 'Eau Minérale (Bouteille)', prix_ttc: 15, taxe_idx: 1 },
        { nom: 'Eau Gazeuse (Bouteille)', prix_ttc: 18, taxe_idx: 1 },
        { nom: 'Jus Frais', prix_ttc: 30, taxe_idx: 3 },
        { nom: 'Café Espresso', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Thé Cérémonie', prix_ttc: 20, taxe_idx: 3 },
      ],
      'Menu Déjeuner': [
        { nom: 'Menu 2 Plats (entrée+plat)', prix_ttc: 120, taxe_idx: 3 },
        { nom: 'Menu 3 Plats (entrée+plat+dessert)', prix_ttc: 150, taxe_idx: 3 },
        { nom: 'Menu Business', prix_ttc: 95, taxe_idx: 3 },
      ],
    },

    features: {
      tables: true,
      kds: true,
      code_barres: false,
      livraison: false,
      emporter: false,
      sur_place: true,
      fidelite: true,
      pourboire: true,
    },

    types_commande: ['sur_place'],

    ticket_defaults: {
      ticket_show_logo: '1', ticket_show_adresse: '1', ticket_show_telephone: '1',
      ticket_show_ice: '1', ticket_show_caissier: '1', ticket_show_articles: '1',
      ticket_show_tva_detail: '1', ticket_show_ht: '1', ticket_show_monnaie: '1',
      ticket_show_points: '1', ticket_show_client: '1', ticket_show_type_cmd: '0',
      ticket_show_header: '1', ticket_show_footer: '1', ticket_show_date_heure: '1',
      ticket_show_numero: '1', ticket_show_mode_paiement: '1', ticket_show_remise: '1',
      ticket_font_size: '13', ticket_largeur: '300', ticket_message_promo: '',
    },

    parametres_defaults: {
      devise: 'DH', tva_defaut: '10', points_par_dh: '1',
      seuil_points_cadeau: '1000', ticket_footer: 'Merci de nous avoir choisis 🪑',
      ticket_header: '', auto_backup: '1',
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                    FAST-FOOD / SNACK                      ║
  // ╚═══════════════════════════════════════════════════════════╝
  fast_food: {
    id: 'fast_food',
    famille: 'restaurant',
    nom: 'Fast-Food / Snack',
    icone: '🍔',
    description: 'Fast-food, snack, sandwicherie — commande rapide, à emporter ou sur place',
    couleur_primaire: '#e65100',
    couleur_accent: '#ff6d00',
    header_gradient: 'linear-gradient(135deg, #bf360c, #e65100)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Exonéré)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7%', taux: 7, par_defaut: 0 },
      { id: 3, nom: 'TVA 10% (Restauration)', taux: 10, par_defaut: 1 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Burgers', couleur: '#e65100', icone: '🍔', ordre: 1 },
      { nom: 'Sandwichs', couleur: '#f39c12', icone: '🥙', ordre: 2 },
      { nom: 'Pizzas', couleur: '#c0392b', icone: '🍕', ordre: 3 },
      { nom: 'Accompagnements', couleur: '#f1c40f', icone: '🍟', ordre: 4 },
      { nom: 'Boissons', couleur: '#3498db', icone: '🥤', ordre: 5 },
      { nom: 'Menus', couleur: '#27ae60', icone: '🍱', ordre: 6 },
    ],

    produits: {
      'Burgers': [
        { nom: 'Classic Burger', prix_ttc: 40, taxe_idx: 3 },
        { nom: 'Double Cheese', prix_ttc: 55, taxe_idx: 3 },
        { nom: 'Burger Poulet', prix_ttc: 45, taxe_idx: 3 },
        { nom: 'Burger Kefta', prix_ttc: 42, taxe_idx: 3 },
        { nom: 'Burger Végétarien', prix_ttc: 38, taxe_idx: 3 },
        { nom: 'XL Burger', prix_ttc: 65, taxe_idx: 3 },
      ],
      'Sandwichs': [
        { nom: 'Sandwich Kefta', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Sandwich Poulet', prix_ttc: 28, taxe_idx: 3 },
        { nom: 'Sandwich Thon', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Panini Mixte', prix_ttc: 30, taxe_idx: 3 },
        { nom: 'Hot-Dog', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Wrap Poulet', prix_ttc: 32, taxe_idx: 3 },
      ],
      'Pizzas': [
        { nom: 'Pizza Margherita', prix_ttc: 55, taxe_idx: 3 },
        { nom: 'Pizza Poulet BBQ', prix_ttc: 65, taxe_idx: 3 },
        { nom: 'Pizza Mixte', prix_ttc: 70, taxe_idx: 3 },
        { nom: 'Pizza Kefta', prix_ttc: 60, taxe_idx: 3 },
      ],
      'Accompagnements': [
        { nom: 'Frites Maison', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Frites + Sauce', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Nuggets (6p)', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Onion Rings', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Salade Coleslaw', prix_ttc: 12, taxe_idx: 3 },
      ],
      'Boissons': [
        { nom: 'Soda (grand)', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Soda (petit)', prix_ttc: 8, taxe_idx: 3 },
        { nom: 'Eau Minérale', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Jus en Brique', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Milkshake', prix_ttc: 22, taxe_idx: 3 },
      ],
      'Menus': [
        { nom: 'Menu Burger + Frites + Soda', prix_ttc: 55, taxe_idx: 3 },
        { nom: 'Menu Sandwich + Frites', prix_ttc: 38, taxe_idx: 3 },
        { nom: 'Menu Pizza + Boisson', prix_ttc: 70, taxe_idx: 3 },
        { nom: 'Menu Enfant', prix_ttc: 40, taxe_idx: 3 },
      ],
    },

    features: {
      tables: false,
      kds: true,
      code_barres: false,
      livraison: true,
      emporter: true,
      sur_place: true,
      fidelite: true,
      pourboire: false,
    },

    types_commande: ['sur_place', 'emporter', 'livraison'],

    ticket_defaults: {
      ticket_show_logo: '1', ticket_show_adresse: '1', ticket_show_telephone: '1',
      ticket_show_ice: '0', ticket_show_caissier: '1', ticket_show_articles: '1',
      ticket_show_tva_detail: '0', ticket_show_ht: '0', ticket_show_monnaie: '1',
      ticket_show_points: '1', ticket_show_client: '0', ticket_show_type_cmd: '1',
      ticket_show_header: '1', ticket_show_footer: '1', ticket_show_date_heure: '1',
      ticket_show_numero: '1', ticket_show_mode_paiement: '1', ticket_show_remise: '1',
      ticket_font_size: '14', ticket_largeur: '300', ticket_message_promo: '',
    },

    parametres_defaults: {
      devise: 'DH', tva_defaut: '10', points_par_dh: '1',
      seuil_points_cadeau: '300', ticket_footer: 'Bonne dégustation 🍔',
      ticket_header: '', auto_backup: '1',
    },
  },
};

/**
 * Retourne la liste des profils Café/Restaurant (sans les produits, pour le wizard)
 */
function getProfilesList() {
  return Object.values(PROFILES)
    .filter(p => ALLOWED_PROFILE_IDS.includes(p.id))
    .map(p => ({
      id: p.id,
      famille: p.famille,
      nom: p.nom,
      icone: p.icone,
      description: p.description,
      couleur_primaire: p.couleur_primaire,
      couleur_accent: p.couleur_accent,
      nb_categories: p.categories.length,
      nb_produits: Object.values(p.produits).reduce((sum, arr) => sum + arr.length, 0),
      features: p.features,
      types_commande: p.types_commande,
    }));
}

/**
 * Retourne un profil complet par son ID.
 * Renvoie null pour tout id hors whitelist Café/Restaurant.
 */
function getProfile(id) {
  if (!ALLOWED_PROFILE_IDS.includes(id)) return null;
  return PROFILES[id] || null;
}

module.exports = { PROFILES, ALLOWED_PROFILE_IDS, getProfilesList, getProfile };
