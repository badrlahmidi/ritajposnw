/**
 * ═══════════════════════════════════════════════════════════════
 *  PROFILS MÉTIER — Configuration multi-commerce POS 2026
 *  Chaque profil définit : catégories, produits, taxes, features,
 *  thème visuel, types de commande, et paramètres ticket.
 * ═══════════════════════════════════════════════════════════════
 */

const PROFILES = {

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                        CAFÉ                               ║
  // ╚═══════════════════════════════════════════════════════════╝
  cafe: {
    id: 'cafe',
    nom: 'Café',
    icone: '☕',
    description: 'Café, salon de thé, coffee shop — boissons chaudes & froides, pâtisseries, snacks',
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
  // ║                    BOULANGERIE                            ║
  // ╚═══════════════════════════════════════════════════════════╝
  boulangerie: {
    id: 'boulangerie',
    nom: 'Boulangerie / Pâtisserie',
    icone: '🍞',
    description: 'Boulangerie, pâtisserie, fournil — pains, viennoiseries, gâteaux, sandwichs',
    couleur_primaire: '#d35400',
    couleur_accent: '#e67e22',
    header_gradient: 'linear-gradient(135deg, #a04000, #d35400)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Pain de base)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7%', taux: 7, par_defaut: 0 },
      { id: 3, nom: 'TVA 10% (Restauration)', taux: 10, par_defaut: 1 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Pains', couleur: '#e67e22', icone: '🍞', ordre: 1 },
      { nom: 'Viennoiseries', couleur: '#f39c12', icone: '🥐', ordre: 2 },
      { nom: 'Pâtisseries', couleur: '#e74c3c', icone: '🍰', ordre: 3 },
      { nom: 'Sandwichs', couleur: '#27ae60', icone: '🥪', ordre: 4 },
      { nom: 'Boissons Chaudes', couleur: '#8e44ad', icone: '☕', ordre: 5 },
      { nom: 'Boissons Froides', couleur: '#3498db', icone: '🧃', ordre: 6 },
      { nom: 'Salades', couleur: '#2ecc71', icone: '🥗', ordre: 7 },
      { nom: 'Desserts', couleur: '#e91e63', icone: '🍮', ordre: 8 },
    ],

    produits: {
      'Pains': [
        { nom: 'Baguette Tradition', prix_ttc: 3.50, taxe_idx: 1 },
        { nom: 'Pain Complet', prix_ttc: 8, taxe_idx: 1 },
        { nom: 'Pain de Campagne', prix_ttc: 10, taxe_idx: 1 },
        { nom: 'Pain aux Céréales', prix_ttc: 12, taxe_idx: 2 },
        { nom: 'Pain de Mie', prix_ttc: 15, taxe_idx: 2 },
        { nom: 'Pain aux Olives', prix_ttc: 14, taxe_idx: 2 },
        { nom: 'Pain au Seigle', prix_ttc: 12, taxe_idx: 2 },
        { nom: 'Focaccia', prix_ttc: 18, taxe_idx: 3 },
      ],
      'Viennoiseries': [
        { nom: 'Croissant', prix_ttc: 4, taxe_idx: 3 },
        { nom: 'Pain au Chocolat', prix_ttc: 5, taxe_idx: 3 },
        { nom: 'Chausson aux Pommes', prix_ttc: 8, taxe_idx: 3 },
        { nom: 'Brioche Nature', prix_ttc: 6, taxe_idx: 3 },
        { nom: 'Pain aux Raisins', prix_ttc: 6, taxe_idx: 3 },
        { nom: 'Croissant aux Amandes', prix_ttc: 8, taxe_idx: 3 },
      ],
      'Pâtisseries': [
        { nom: 'Tarte aux Fruits', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Éclair au Chocolat', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Millefeuille', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Tarte au Citron', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Opéra', prix_ttc: 28, taxe_idx: 3 },
        { nom: 'Paris-Brest', prix_ttc: 20, taxe_idx: 3 },
      ],
      'Sandwichs': [
        { nom: 'Sandwich Poulet', prix_ttc: 28, taxe_idx: 3 },
        { nom: 'Sandwich Thon', prix_ttc: 25, taxe_idx: 3 },
        { nom: 'Sandwich Végétarien', prix_ttc: 22, taxe_idx: 3 },
        { nom: 'Panini Fromage', prix_ttc: 24, taxe_idx: 3 },
        { nom: 'Croque Monsieur', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Wrap César', prix_ttc: 26, taxe_idx: 3 },
      ],
      'Boissons Chaudes': [
        { nom: 'Café Expresso', prix_ttc: 8, taxe_idx: 3 },
        { nom: 'Café Latte', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Cappuccino', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Thé Vert', prix_ttc: 10, taxe_idx: 3 },
        { nom: 'Chocolat Chaud', prix_ttc: 14, taxe_idx: 3 },
        { nom: 'Thé à la Menthe', prix_ttc: 10, taxe_idx: 3 },
      ],
      'Boissons Froides': [
        { nom: 'Jus d\'Orange Pressé', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Limonade Maison', prix_ttc: 12, taxe_idx: 3 },
        { nom: 'Smoothie Fruits Rouges', prix_ttc: 20, taxe_idx: 3 },
        { nom: 'Eau Minérale', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Ice Tea', prix_ttc: 10, taxe_idx: 3 },
      ],
      'Salades': [
        { nom: 'Salade César', prix_ttc: 32, taxe_idx: 3 },
        { nom: 'Salade Niçoise', prix_ttc: 30, taxe_idx: 3 },
        { nom: 'Salade Chèvre Chaud', prix_ttc: 28, taxe_idx: 3 },
        { nom: 'Bowl Quinoa', prix_ttc: 35, taxe_idx: 3 },
      ],
      'Desserts': [
        { nom: 'Crème Brûlée', prix_ttc: 18, taxe_idx: 3 },
        { nom: 'Mousse au Chocolat', prix_ttc: 15, taxe_idx: 3 },
        { nom: 'Panna Cotta', prix_ttc: 16, taxe_idx: 3 },
        { nom: 'Tiramisu', prix_ttc: 20, taxe_idx: 3 },
      ],
    },

    features: {
      tables: false,
      kds: false,
      code_barres: true,
      livraison: false,
      emporter: true,
      sur_place: true,
      fidelite: true,
      pourboire: false,
    },

    types_commande: ['emporter', 'sur_place'],

    ticket_defaults: {
      ticket_show_logo: '1',
      ticket_show_adresse: '1',
      ticket_show_telephone: '1',
      ticket_show_ice: '1',
      ticket_show_caissier: '1',
      ticket_show_articles: '1',
      ticket_show_tva_detail: '1',
      ticket_show_ht: '1',
      ticket_show_monnaie: '1',
      ticket_show_points: '1',
      ticket_show_client: '1',
      ticket_show_type_cmd: '0',
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
      ticket_footer: 'Merci de votre visite ! 🍞',
      ticket_header: '',
      auto_backup: '1',
    },
  },

  // ╔═══════════════════════════════════════════════════════════╗
  // ║                 BOUTIQUE / SUPERETTE                      ║
  // ╚═══════════════════════════════════════════════════════════╝
  superette: {
    id: 'superette',
    nom: 'Boutique / Superette',
    icone: '🛒',
    description: 'Épicerie, superette, boutique — alimentation générale, hygiène, produits ménagers',
    couleur_primaire: '#2980b9',
    couleur_accent: '#3498db',
    header_gradient: 'linear-gradient(135deg, #1a5276, #2980b9)',

    taxes: [
      { id: 1, nom: 'TVA 0% (Exonéré)', taux: 0, par_defaut: 0 },
      { id: 2, nom: 'TVA 7% (Alimentaire)', taux: 7, par_defaut: 1 },
      { id: 3, nom: 'TVA 10%', taux: 10, par_defaut: 0 },
      { id: 4, nom: 'TVA 14%', taux: 14, par_defaut: 0 },
      { id: 5, nom: 'TVA 20% (Standard)', taux: 20, par_defaut: 0 },
    ],

    categories: [
      { nom: 'Épicerie', couleur: '#e67e22', icone: '🏪', ordre: 1 },
      { nom: 'Fruits & Légumes', couleur: '#27ae60', icone: '🥬', ordre: 2 },
      { nom: 'Produits Laitiers', couleur: '#3498db', icone: '🧀', ordre: 3 },
      { nom: 'Boulangerie', couleur: '#d35400', icone: '🍞', ordre: 4 },
      { nom: 'Boissons', couleur: '#8e44ad', icone: '🥤', ordre: 5 },
      { nom: 'Hygiène & Beauté', couleur: '#e91e63', icone: '🧴', ordre: 6 },
      { nom: 'Ménage', couleur: '#00bcd4', icone: '🧹', ordre: 7 },
      { nom: 'Snacks & Confiserie', couleur: '#f39c12', icone: '🍫', ordre: 8 },
    ],

    produits: {
      'Épicerie': [
        { nom: 'Huile d\'Olive 1L', prix_ttc: 45, taxe_idx: 1 },
        { nom: 'Sucre 1kg', prix_ttc: 8, taxe_idx: 1 },
        { nom: 'Farine 1kg', prix_ttc: 6, taxe_idx: 1 },
        { nom: 'Riz 1kg', prix_ttc: 15, taxe_idx: 2 },
        { nom: 'Pâtes 500g', prix_ttc: 8, taxe_idx: 2 },
        { nom: 'Tomates en Conserve', prix_ttc: 6, taxe_idx: 2 },
        { nom: 'Thé Vert 200g', prix_ttc: 25, taxe_idx: 2 },
        { nom: 'Café Moulu 250g', prix_ttc: 30, taxe_idx: 2 },
        { nom: 'Sel 1kg', prix_ttc: 3, taxe_idx: 1 },
        { nom: 'Œufs (plaquette 30)', prix_ttc: 38, taxe_idx: 1 },
      ],
      'Fruits & Légumes': [
        { nom: 'Tomates (1kg)', prix_ttc: 8, taxe_idx: 1 },
        { nom: 'Oignons (1kg)', prix_ttc: 6, taxe_idx: 1 },
        { nom: 'Pommes de Terre (1kg)', prix_ttc: 7, taxe_idx: 1 },
        { nom: 'Bananes (1kg)', prix_ttc: 12, taxe_idx: 1 },
        { nom: 'Oranges (1kg)', prix_ttc: 8, taxe_idx: 1 },
        { nom: 'Citrons (1kg)', prix_ttc: 10, taxe_idx: 1 },
        { nom: 'Carottes (1kg)', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Salade (pièce)', prix_ttc: 4, taxe_idx: 1 },
      ],
      'Produits Laitiers': [
        { nom: 'Lait 1L', prix_ttc: 7, taxe_idx: 1 },
        { nom: 'Yaourt Nature (pack 6)', prix_ttc: 12, taxe_idx: 2 },
        { nom: 'Beurre 200g', prix_ttc: 14, taxe_idx: 2 },
        { nom: 'Fromage Fondu', prix_ttc: 10, taxe_idx: 2 },
        { nom: 'Crème Fraîche', prix_ttc: 8, taxe_idx: 2 },
        { nom: 'Jben (pot)', prix_ttc: 6, taxe_idx: 1 },
      ],
      'Boulangerie': [
        { nom: 'Pain Blanc', prix_ttc: 1.20, taxe_idx: 1 },
        { nom: 'Pain Complet', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Msemen (lot 5)', prix_ttc: 5, taxe_idx: 1 },
        { nom: 'Harcha', prix_ttc: 3, taxe_idx: 1 },
        { nom: 'Batbout (lot 5)', prix_ttc: 5, taxe_idx: 1 },
      ],
      'Boissons': [
        { nom: 'Eau Sidi Ali 1.5L', prix_ttc: 4, taxe_idx: 1 },
        { nom: 'Coca-Cola 1L', prix_ttc: 10, taxe_idx: 5 },
        { nom: 'Jus Vitrac 1L', prix_ttc: 12, taxe_idx: 2 },
        { nom: 'Eau Oulmès 1L', prix_ttc: 6, taxe_idx: 1 },
        { nom: 'Soda Canette', prix_ttc: 6, taxe_idx: 5 },
      ],
      'Hygiène & Beauté': [
        { nom: 'Savon Liquide', prix_ttc: 18, taxe_idx: 5 },
        { nom: 'Shampooing', prix_ttc: 25, taxe_idx: 5 },
        { nom: 'Dentifrice', prix_ttc: 15, taxe_idx: 5 },
        { nom: 'Papier Toilette (4 rouleaux)', prix_ttc: 12, taxe_idx: 5 },
        { nom: 'Mouchoirs (pack)', prix_ttc: 8, taxe_idx: 5 },
      ],
      'Ménage': [
        { nom: 'Javel 1L', prix_ttc: 6, taxe_idx: 5 },
        { nom: 'Détergent Vaisselle', prix_ttc: 12, taxe_idx: 5 },
        { nom: 'Lessive 1kg', prix_ttc: 22, taxe_idx: 5 },
        { nom: 'Sacs Poubelle (10)', prix_ttc: 5, taxe_idx: 5 },
        { nom: 'Éponge (lot 3)', prix_ttc: 8, taxe_idx: 5 },
      ],
      'Snacks & Confiserie': [
        { nom: 'Chips (paquet)', prix_ttc: 5, taxe_idx: 5 },
        { nom: 'Biscuits', prix_ttc: 8, taxe_idx: 2 },
        { nom: 'Chocolat Tablette', prix_ttc: 12, taxe_idx: 5 },
        { nom: 'Bonbons (sachet)', prix_ttc: 5, taxe_idx: 5 },
        { nom: 'Gaufrettes', prix_ttc: 3, taxe_idx: 2 },
      ],
    },

    features: {
      tables: false,
      kds: false,
      code_barres: true,
      livraison: true,
      emporter: true,
      sur_place: false,
      fidelite: true,
      pourboire: false,
    },

    types_commande: ['emporter', 'livraison'],

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
      ticket_show_client: '0',
      ticket_show_type_cmd: '0',
      ticket_show_header: '1',
      ticket_show_footer: '1',
      ticket_show_date_heure: '1',
      ticket_show_numero: '1',
      ticket_show_mode_paiement: '1',
      ticket_show_remise: '1',
      ticket_font_size: '12',
      ticket_largeur: '300',
      ticket_message_promo: '',
    },

    parametres_defaults: {
      devise: 'DH',
      tva_defaut: '7',
      points_par_dh: '1',
      seuil_points_cadeau: '1000',
      ticket_footer: 'Merci et à bientôt ! 🛒',
      ticket_header: '',
      auto_backup: '1',
    },
  },
};

/**
 * Retourne la liste des profils (sans les produits détaillés, pour le wizard)
 */
function getProfilesList() {
  return Object.values(PROFILES).map(p => ({
    id: p.id,
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
 * Retourne un profil complet par son ID
 */
function getProfile(id) {
  return PROFILES[id] || null;
}

module.exports = { PROFILES, getProfilesList, getProfile };
