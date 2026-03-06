# 🆘 COMMENT RESTAURER LA BASE DE DONNÉES

Si vous avez supprimé `pos.db` par erreur, voici comment récupérer vos données.

## 1. Méthode Automatique (Recommandée)
J'ai créé un script qui restaure automatiquement la sauvegarde la plus récente.

1. Arrêtez le serveur (fermez la fenêtre de commande).
2. Ouvrez un terminal dans le dossier `server`.
3. Exécutez la commande suivante :
   ```bash
   node restore_db.js
   ```
4. Redémarrez le serveur (`npm start`).

## 2. Méthode Manuelle
Si vous préférez le faire vous-même :

1. Allez dans le dossier `server/backups`.
2. Trouvez le fichier `.db` le plus récent (ex: `backup_2026-02-13_....db`).
3. Copiez ce fichier dans le dossier `server`.
4. Renommez-le en `pos.db`.
5. Redémarrez le serveur.

## ⚠️ Important
- Si le serveur **était en cours d'exécution** quand vous avez supprimé le fichier, **NE LE FERMEZ PAS BRUTALEMENT**. Essayez de faire une modification dans l'application (ex: changer un prix) : cela forcera une sauvegarde et recréera le fichier `pos.db` sans perte de données !
