# Wordox

Jeu de lettres proche du Scrabble, où l'on vole les lettres des autres joueurs.

## Règles

- Plateau de 9 × 9 cases, chevalet de 6 lettres par joueur.
- Tous les mots font au moins 2 lettres.
- Le premier mot passe par la case centrale ; les suivants touchent des lettres déjà posées.
- **Capture** : toutes les lettres des mots formés prennent la couleur du joueur.
- **Score** : 1 point par case de sa couleur sur le plateau, plus les points figés.
- **Coins étoilés** : poser une lettre sur un coin vide le plateau et fige les scores.
- Le premier joueur qui atteint l'objectif (25 points par défaut, réglable) gagne.
- On peut passer son tour et échanger des lettres. Si tout le monde passe deux fois de suite,
  le meilleur score l'emporte.

## Modes de jeu

- **Solo** : 1 à 3 ordinateurs (bleu = vous, puis rouge, jaune, vert), chacun avec un niveau de 1 à 10.
  La partie est sauvegardée dans le navigateur : recharger la page y ramène directement, et le menu
  propose de la reprendre plus tard.
- **Deux joueurs en ligne** : l'hôte crée une partie et transmet le code (ou le lien) à l'invité.
  La partie circule ensuite directement entre les deux navigateurs (WebRTC) ; le serveur ne sert
  qu'à les mettre en relation. Il n'y a pas de relais : sur certains réseaux (4G, pare-feu
  d'entreprise) la connexion directe peut échouer.

## Installation

Copier le dossier sur un serveur web avec PHP 5.3 ou plus récent. Aucune base de données.

- Le dossier `data/` doit être inscriptible par PHP (il est créé au besoin).
- Le fichier `.htaccess` bloque l'accès à `data/`, `tools/` et `.git` (Apache).
- `tools/` ne sert qu'au développement et n'a pas besoin d'être déployé.
- Les polices (Bricolage Grotesque, Figtree) sont dans `fonts/`, avec leur licence (SIL Open Font
  License) : aucune police n'est chargée depuis un autre site.

## Organisation

| Fichier | Rôle |
|---|---|
| `index.php` | Page unique |
| `dict.php` | Sert `dict/words.txt` compressé |
| `api/signal.php` | Mise en relation des deux joueurs d'une partie en ligne |
| `js/rules.js` | Règles du jeu (sans DOM : utilisé aussi par l'IA et les tests) |
| `js/ai.js`, `js/ai-worker.js` | Recherche et choix des coups de l'ordinateur, dans un Web Worker |
| `js/dnd.js` | Glisser-déposer (souris, doigt, stylet) |
| `js/net.js` | Connexion pair-à-pair |
| `js/app.js` | Écrans, affichage, déroulement de la partie |
| `css/style.css` | Couleurs, lettres en relief, mise en page adaptative |

## Dictionnaire et niveaux de l'IA

Les mots valides sont ceux de l'Officiel du Scrabble dans son édition 2004 (ODS4), limités à
9 lettres : 156 878 mots. Les humains peuvent tous les jouer.

Chaque mot porte un niveau de 1 à 10, calculé à partir de sa fréquence d'usage
([Lexique 3.83](http://www.lexique.org)) : une IA ne joue que les mots de son niveau ou d'un niveau
inférieur. Les petits mots classiques du Scrabble sont connus plus tôt (2 lettres dès le niveau 4,
3 lettres dès le niveau 6, 4 lettres dès le niveau 8) et le niveau 10 connaît tout le dictionnaire.

Le niveau règle aussi le jugement de l'IA : part des coups qu'elle repère, prise en compte des vols
et des coins étoilés, anticipation de la riposte adverse (niveaux 8 à 10). Les réglages sont dans
`LEVELS`, en tête de `js/ai.js`.

## Outils de développement (Node)

```bash
node tools/test-rules.js       # tests des règles et du générateur de coups
node tools/sim.js 100          # duels IA contre IA, pour calibrer les niveaux
node tools/sim.js 1 --words    # exemples de mots joués à chaque niveau
node tools/build-dict.js       # reconstruit dict/words.txt
```

`build-dict.js` lit `tools/data/ods4.txt` et `tools/data/Lexique383.tsv`. Ce dernier n'est pas
versionné : le télécharger depuis http://www.lexique.org/databases/Lexique383/Lexique383.tsv.
Les seuils de niveaux sont en tête du script.
