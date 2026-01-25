# Wordox - Jeu de Lettres avec IA

## 🎮 Description
Jeu de type Wordox où vous jouez contre 3 adversaires IA de différents niveaux.

## 👥 Joueurs

- **Joueur 1 (Bleu)** : Vous - Joueur humain
- **Joueur 2 (Rouge)** : IA Faible - Joue des coups aléatoires parmi les premières options trouvées
- **Joueur 3 (Vert)** : IA Moyenne - Joue des coups décents dans le top 30% des meilleurs coups
- **Joueur 4 (Jaune)** : IA Forte - Joue les meilleurs coups possibles

## 🤖 Système d'IA

### Architecture
Le système d'IA est séparé dans le fichier `ai.js` et utilise les stratégies suivantes :

#### Recherche de coups
1. **Premier coup / Après reset** : Trouve tous les mots possibles qui passent par le centre (4,4)
2. **Coups suivants** : Trouve tous les mots possibles qui touchent des lettres existantes

#### Stratégies par niveau

**IA Faible (Joueur 2)**
- Joue le premier coup valide trouvé
- Ou un coup aléatoire parmi les 5 premiers
- Rapide mais pas optimale

**IA Moyenne (Joueur 3)**
- Évalue tous les coups possibles
- Trie par score estimé
- Joue un coup dans le top 30%
- Équilibre entre rapidité et qualité

**IA Forte (Joueur 4)**
- Évalue tous les coups possibles
- Calcule le score avec bonus (mots longs, coins étoilés, captures)
- Joue le meilleur coup (ou parmi les 3 meilleurs)
- Stratégie optimale

#### Évaluation des coups
L'IA évalue chaque coup selon :
- Longueur du mot (mots longs = bonus)
- Lettres capturées aux adversaires
- Cases spéciales (coins étoilés)
- Position stratégique sur le plateau

### Automatisation
- Les IA jouent automatiquement après un délai de 1 seconde
- Les boutons sont désactivés pendant le tour d'une IA
- Le chevalet et le plateau sont bloqués pour le joueur humain
- L'historique affiche les coups de toutes les IA

## 🎯 Comment jouer

1. Ouvrez `index.html` dans votre navigateur
2. Le jeu commence automatiquement (ou charge la partie sauvegardée)
3. À votre tour (Joueur 1 Bleu) :
   - Cliquez sur une lettre du chevalet
   - Cliquez sur une case vide pour la placer
   - Formez un mot d'**au moins 2 lettres**
   - Validez votre mot
4. Les 3 IA jouent automatiquement à tour de rôle
5. Atteignez 25 points pour gagner !

## 📏 Règles importantes

- **Mots minimum** : Tous les mots doivent faire au moins 2 lettres
- **Premier coup** : Doit chevaucher la case centrale (4,4)
- **Coups suivants** : Doivent toucher des lettres déjà posées
- **Capture** : Toutes les lettres des mots formés prennent votre couleur
- **Coins étoilés** : Réinitialisent le plateau et figent les scores
- **Score** : 1 point par case de votre couleur sur le plateau

## 📁 Fichiers

- `index.html` : Interface du jeu
- `style.css` : Styles visuels
- `game.js` : Logique principale du jeu
- `ai.js` : Système d'intelligence artificielle
- `dictionary.json` : Dictionnaire des mots valides

## 💾 Sauvegarde

Le jeu sauvegarde automatiquement votre progression dans le LocalStorage du navigateur.

## 🎨 Personnalisation

Vous pouvez facilement modifier les niveaux d'IA dans `ai.js` :
- Ajuster les pourcentages de sélection des coups
- Modifier les critères d'évaluation
- Ajouter de nouveaux algorithmes

Bon jeu ! 🎲

