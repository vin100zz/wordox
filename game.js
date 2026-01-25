// Chargement du dictionnaire
let dictionary = [];

// Distribution des lettres du sabot (basée sur la fréquence en français)
const LETTER_DISTRIBUTION = {
    'E': 35,  // La lettre la plus fréquente en français
    'A': 20,  'I': 18,  'S': 16,  'N': 15,  'R': 14,  'T': 14,  // Très courantes
    'O': 13,  'L': 12,  'U': 12,  // Courantes
    'D': 7,   'M': 6,   'P': 5,   'C': 5,   // Moyennement courantes
    'B': 3,   'V': 3,   'H': 3,   'F': 3,   'G': 3,   // Moins courantes
    'Q': 2,   'J': 2,   'X': 1,   'Y': 1,   // Rares
    'Z': 1,   'K': 1,   'W': 1    // Très rares
};

// État du jeu
let gameState = {
    board: Array(9).fill(null).map(() => Array(9).fill(null)),
    rack: [],
    bag: [],
    currentPlayer: 0, // 0-3
    scores: [0, 0, 0, 0],
    frozenScores: [0, 0, 0, 0],
    passCount: 0,
    history: [],
    temporaryPlacements: [],
    selectedTile: null,
    mustUseCenterOnNextTurn: true,
    gameOver: false
};

const PLAYER_COLORS = ['player-1', 'player-2', 'player-3', 'player-4'];
const PLAYER_NAMES = ['Joueur 1 (Bleu)', 'Joueur 2 (Rouge)', 'Joueur 3 (Vert)', 'Joueur 4 (Jaune)'];

// Initialisation
async function init() {
    await loadDictionary();
    loadGameState();
    setupEventListeners();
    renderBoard();
    updateUI();

    // Si c'est le tour d'une IA après le chargement, la faire jouer
    if (gameState.currentPlayer > 0 && !gameState.gameOver) {
        setTimeout(() => {
            playAITurn();
        }, 1000);
    }
}

// Chargement du dictionnaire
async function loadDictionary() {
    try {
        const response = await fetch('dictionary.json');
        dictionary = await response.json();
        console.log(`Dictionnaire chargé: ${dictionary.length} mots`);
    } catch (error) {
        console.error('Erreur lors du chargement du dictionnaire:', error);
        alert('Erreur lors du chargement du dictionnaire');
    }
}

// Initialisation du sac de lettres
function initBag() {
    const bag = [];
    for (const [letter, count] of Object.entries(LETTER_DISTRIBUTION)) {
        for (let i = 0; i < count; i++) {
            bag.push(letter);
        }
    }
    // Mélange du sac
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

// Pioche de lettres
function drawTiles(count) {
    const drawn = [];
    for (let i = 0; i < count && gameState.bag.length > 0; i++) {
        drawn.push(gameState.bag.pop());
    }
    return drawn;
}

// Remplissage du chevalet
function fillRack() {
    const needed = 6 - gameState.rack.length;
    if (needed > 0) {
        const drawn = drawTiles(needed);
        gameState.rack.push(...drawn);
    }
}

// Nouvelle partie
function newGame() {
    gameState = {
        board: Array(9).fill(null).map(() => Array(9).fill(null)),
        rack: [],
        bag: initBag(),
        currentPlayer: 0,
        scores: [0, 0, 0, 0],
        frozenScores: [0, 0, 0, 0],
        passCount: 0,
        history: [],
        temporaryPlacements: [],
        selectedTile: null,
        mustUseCenterOnNextTurn: true,
        gameOver: false
    };

    fillRack();
    saveGameState();
    renderBoard();
    updateUI();

    document.getElementById('gameOverModal').classList.remove('show');
}

// Sauvegarde de l'état du jeu
function saveGameState() {
    try {
        localStorage.setItem('wordoxGameState', JSON.stringify(gameState));
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
    }
}

// Chargement de l'état du jeu
function loadGameState() {
    try {
        const saved = localStorage.getItem('wordoxGameState');
        if (saved) {
            const loaded = JSON.parse(saved);
            // Vérification que l'état chargé est valide
            if (loaded.board && loaded.rack) {
                gameState = loaded;
                return;
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement:', error);
    }
    // Si pas de sauvegarde valide, nouvelle partie
    newGame();
}

// Rendu du plateau
function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            // Cases spéciales
            if (row === 4 && col === 4) {
                cell.classList.add('center');
            }
            if ((row === 0 || row === 8) && (col === 0 || col === 8)) {
                cell.classList.add('star');
            }

            // Contenu de la case
            const content = gameState.board[row][col];
            if (content) {
                cell.textContent = content.letter;
                cell.classList.add('occupied', PLAYER_COLORS[content.player]);
            }

            // Placements temporaires
            const temp = gameState.temporaryPlacements.find(p => p.row === row && p.col === col);
            if (temp) {
                cell.textContent = temp.letter;
                cell.classList.add('temporary', PLAYER_COLORS[gameState.currentPlayer]);
                // Rendre la cellule draggable pour permettre de déplacer la lettre
                cell.draggable = true;
                cell.dataset.tempIndex = gameState.temporaryPlacements.indexOf(temp);
                cell.addEventListener('dragstart', handleCellDragStart);
                cell.addEventListener('dragend', handleCellDragEnd);
                // Support tactile mobile
                cell.addEventListener('touchstart', handleCellTouchStart, { passive: false });
                cell.addEventListener('touchend', handleTouchEnd);
            }

            cell.addEventListener('click', () => handleCellClick(row, col));

            // Ajouter les événements de drag and drop
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('drop', handleDrop);
            cell.addEventListener('dragleave', handleDragLeave);

            // Support tactile mobile pour le drop
            cell.addEventListener('touchmove', handleTouchMove, { passive: false });

            boardEl.appendChild(cell);
        }
    }
}

// Rendu du chevalet
function renderRack() {
    const rackEl = document.getElementById('rack');
    rackEl.innerHTML = '';

    // Ajouter les événements de drop sur le chevalet pour permettre de remettre les lettres
    rackEl.addEventListener('dragover', handleRackDragOver);
    rackEl.addEventListener('drop', handleRackDrop);

    // Support tactile mobile
    rackEl.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Récupérer les indices utilisés
    const usedIndices = gameState.temporaryPlacements.map(p => p.rackIndex);

    gameState.rack.forEach((letter, index) => {
        const tile = document.createElement('div');
        tile.className = `tile ${PLAYER_COLORS[gameState.currentPlayer]}`;
        tile.textContent = letter;
        tile.dataset.index = index;

        if (gameState.selectedTile === index) {
            tile.classList.add('selected');
        }

        // Marquer comme utilisée si la tuile est placée sur le plateau
        if (usedIndices.includes(index)) {
            tile.classList.add('used');
        } else {
            // Activer le drag and drop seulement pour les tuiles non utilisées
            tile.draggable = true;
            tile.addEventListener('dragstart', handleDragStart);
            tile.addEventListener('dragend', handleDragEnd);
            // Support tactile mobile
            tile.addEventListener('touchstart', handleTileTouchStart, { passive: false });
            tile.addEventListener('touchend', handleTouchEnd);
        }

        tile.addEventListener('click', () => handleTileClick(index));
        rackEl.appendChild(tile);
    });
}

// Clic sur une tuile du chevalet
function handleTileClick(index) {
    if (gameState.gameOver || gameState.currentPlayer > 0) return; // Bloquer si IA joue

    // Vérifier si la tuile est déjà utilisée
    const usedIndices = gameState.temporaryPlacements.map(p => p.rackIndex);
    if (usedIndices.includes(index)) return; // Ne pas permettre de sélectionner une tuile déjà placée

    if (gameState.selectedTile === index) {
        gameState.selectedTile = null;
    } else {
        gameState.selectedTile = index;
    }
    renderRack();
}

// Clic sur une case du plateau
function handleCellClick(row, col) {
    if (gameState.gameOver || gameState.currentPlayer > 0) return; // Bloquer si IA joue

    // Si une tuile est sélectionnée et la case est vide
    if (gameState.selectedTile !== null) {
        const existingPlacement = gameState.temporaryPlacements.find(p => p.row === row && p.col === col);
        const boardContent = gameState.board[row][col];

        if (!existingPlacement && !boardContent) {
            // Placer la lettre
            const letter = gameState.rack[gameState.selectedTile];
            gameState.temporaryPlacements.push({
                row,
                col,
                letter,
                rackIndex: gameState.selectedTile
            });
            gameState.selectedTile = null;
            renderBoard();
            renderRack();
        }
    } else {
        // Retirer une tuile temporaire
        const tempIndex = gameState.temporaryPlacements.findIndex(p => p.row === row && p.col === col);
        if (tempIndex !== -1) {
            gameState.temporaryPlacements.splice(tempIndex, 1);
            renderBoard();
            renderRack();
        }
    }
}

// Validation du mot
function validateMove() {
    if (gameState.temporaryPlacements.length === 0) {
        showMessage('Placez au moins une lettre !');
        return;
    }

    // Vérifier l'alignement
    if (!checkAlignment()) {
        showMessage('Les lettres doivent être alignées horizontalement ou verticalement !');
        return;
    }

    // Vérifier la connexion
    if (!checkConnection()) {
        showMessage('Le mot doit toucher des lettres existantes !');
        return;
    }

    // Récupérer tous les mots formés
    const words = getAllFormedWords();

    if (words.length === 0) {
        showMessage('Aucun mot valide formé !');
        return;
    }

    // Vérifier qu'aucun mot ne fait qu'une seule lettre
    const tooShort = words.filter(word => word.length < 2);
    if (tooShort.length > 0) {
        showMessage('Les mots doivent faire au moins 2 lettres !');
        return;
    }

    // Vérifier tous les mots dans le dictionnaire
    const invalidWords = words.filter(word => !isValidWord(word));
    if (invalidWords.length > 0) {
        showMessage(`Mot(s) invalide(s): ${invalidWords.join(', ')}`);
        highlightErrors();
        return;
    }

    // Coup valide - appliquer les changements
    applyMove(words);
}

// Vérifier l'alignement des lettres
function checkAlignment() {
    if (gameState.temporaryPlacements.length === 1) return true;

    const rows = gameState.temporaryPlacements.map(p => p.row);
    const cols = gameState.temporaryPlacements.map(p => p.col);

    const sameRow = rows.every(r => r === rows[0]);
    const sameCol = cols.every(c => c === cols[0]);

    return sameRow || sameCol;
}

// Vérifier la connexion au plateau
function checkConnection() {
    // Premier coup : doit utiliser le centre
    if (gameState.mustUseCenterOnNextTurn) {
        return gameState.temporaryPlacements.some(p => p.row === 4 && p.col === 4);
    }

    // Les coups suivants doivent toucher des lettres existantes
    for (const placement of gameState.temporaryPlacements) {
        const neighbors = [
            [placement.row - 1, placement.col],
            [placement.row + 1, placement.col],
            [placement.row, placement.col - 1],
            [placement.row, placement.col + 1]
        ];

        for (const [r, c] of neighbors) {
            if (r >= 0 && r < 9 && c >= 0 && c < 9 && gameState.board[r][c]) {
                return true;
            }
        }
    }

    return false;
}

// Récupérer tous les mots formés
function getAllFormedWords() {
    const words = new Set();

    // Créer un plateau temporaire avec les nouvelles lettres
    const tempBoard = gameState.board.map(row => [...row]);
    for (const placement of gameState.temporaryPlacements) {
        tempBoard[placement.row][placement.col] = {
            letter: placement.letter,
            player: gameState.currentPlayer
        };
    }

    // Trouver le mot principal (celui qui contient toutes les nouvelles lettres)
    const mainWord = getMainWord(tempBoard);
    if (mainWord && mainWord.length > 1) words.add(mainWord);

    // Trouver les mots perpendiculaires
    for (const placement of gameState.temporaryPlacements) {
        const perpWord = getPerpendicularWord(tempBoard, placement.row, placement.col);
        if (perpWord && perpWord.length > 1) words.add(perpWord);
    }

    return Array.from(words);
}

// Obtenir le mot principal
function getMainWord(board) {
    const placements = gameState.temporaryPlacements;
    if (placements.length === 0) return null;

    // Déterminer la direction
    const sameRow = placements.every(p => p.row === placements[0].row);

    if (sameRow) {
        // Mot horizontal
        const row = placements[0].row;
        const cols = placements.map(p => p.col);
        const minCol = Math.min(...cols);
        const maxCol = Math.max(...cols);

        // Étendre à gauche
        let startCol = minCol;
        while (startCol > 0 && board[row][startCol - 1]) startCol--;

        // Étendre à droite
        let endCol = maxCol;
        while (endCol < 8 && board[row][endCol + 1]) endCol++;

        // Construire le mot
        let word = '';
        for (let col = startCol; col <= endCol; col++) {
            if (board[row][col]) {
                word += board[row][col].letter;
            }
        }
        return word.length > 1 ? word : null;
    } else {
        // Mot vertical
        const col = placements[0].col;
        const rows = placements.map(p => p.row);
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);

        // Étendre en haut
        let startRow = minRow;
        while (startRow > 0 && board[startRow - 1][col]) startRow--;

        // Étendre en bas
        let endRow = maxRow;
        while (endRow < 8 && board[endRow + 1][col]) endRow++;

        // Construire le mot
        let word = '';
        for (let row = startRow; row <= endRow; row++) {
            if (board[row][col]) {
                word += board[row][col].letter;
            }
        }
        return word.length > 1 ? word : null;
    }
}

// Obtenir le mot perpendiculaire
function getPerpendicularWord(board, row, col) {
    const placements = gameState.temporaryPlacements;
    const sameRow = placements.every(p => p.row === placements[0].row);

    if (sameRow) {
        // Chercher verticalement
        let startRow = row;
        while (startRow > 0 && board[startRow - 1][col]) startRow--;

        let endRow = row;
        while (endRow < 8 && board[endRow + 1][col]) endRow++;

        if (startRow === endRow) return null;

        let word = '';
        for (let r = startRow; r <= endRow; r++) {
            if (board[r][col]) {
                word += board[r][col].letter;
            }
        }
        return word;
    } else {
        // Chercher horizontalement
        let startCol = col;
        while (startCol > 0 && board[row][startCol - 1]) startCol--;

        let endCol = col;
        while (endCol < 8 && board[row][endCol + 1]) endCol++;

        if (startCol === endCol) return null;

        let word = '';
        for (let c = startCol; c <= endCol; c++) {
            if (board[row][c]) {
                word += board[row][c].letter;
            }
        }
        return word;
    }
}

// Vérifier si un mot est valide
function isValidWord(word) {
    return dictionary.includes(word.toUpperCase());
}

// Appliquer le coup
function applyMove(words) {
    // Placer définitivement les lettres
    for (const placement of gameState.temporaryPlacements) {
        gameState.board[placement.row][placement.col] = {
            letter: placement.letter,
            player: gameState.currentPlayer
        };
    }

    // Changer les couleurs des lettres touchées (maintenant que les nouvelles lettres sont sur le board)
    changeColorsOfAffectedTiles(words);

    // Retirer les lettres du chevalet
    const usedIndices = gameState.temporaryPlacements
        .map(p => p.rackIndex)
        .filter(idx => idx >= 0) // Filtrer les indices invalides
        .sort((a, b) => b - a);
    for (const index of usedIndices) {
        gameState.rack.splice(index, 1);
    }

    // Mettre à jour les scores
    updateScores();

    // Réinitialiser les placements temporaires et le flag du centre
    // (AVANT checkStarCorners car il peut remettre mustUseCenterOnNextTurn à true)
    gameState.temporaryPlacements = [];
    gameState.selectedTile = null;
    gameState.passCount = 0;
    gameState.mustUseCenterOnNextTurn = false;

    // Vérifier les coins étoilés (peut remettre mustUseCenterOnNextTurn à true)
    checkStarCorners();

    // Ajouter à l'historique
    gameState.history.unshift({
        player: gameState.currentPlayer,
        words: words.join(', '),
        score: gameState.scores[gameState.currentPlayer] + gameState.frozenScores[gameState.currentPlayer]
    });


    // Remplir le chevalet
    fillRack();

    // Passer au joueur suivant
    nextPlayer();

    // Vérifier la fin de partie
    checkGameOver();

    saveGameState();
    renderBoard();
    updateUI();
}

// Changer les couleurs des tuiles affectées
function changeColorsOfAffectedTiles(words) {
    // Créer un ensemble de toutes les positions des mots formés CE TOUR
    const affectedPositions = new Set();

    // Créer un plateau temporaire avec les nouvelles lettres
    const tempBoard = gameState.board.map(row => [...row]);

    // Déterminer la direction principale des nouvelles lettres
    const placements = gameState.temporaryPlacements;
    if (placements.length === 0) return;

    const sameRow = placements.every(p => p.row === placements[0].row);

    // Trouver le mot principal
    if (sameRow) {
        // Mot horizontal
        const row = placements[0].row;
        const cols = placements.map(p => p.col);
        const minCol = Math.min(...cols);
        const maxCol = Math.max(...cols);

        // Étendre à gauche
        let startCol = minCol;
        while (startCol > 0 && gameState.board[row][startCol - 1]) startCol--;

        // Étendre à droite
        let endCol = maxCol;
        while (endCol < 8 && gameState.board[row][endCol + 1]) endCol++;

        // Marquer toutes les positions du mot principal
        for (let col = startCol; col <= endCol; col++) {
            affectedPositions.add(`${row},${col}`);
        }

        // Pour chaque nouvelle lettre, chercher les mots perpendiculaires
        for (const placement of placements) {
            const perpPositions = getPerpendicularWordPositions(gameState.board, placement.row, placement.col, false);
            perpPositions.forEach(pos => affectedPositions.add(`${pos.row},${pos.col}`));
        }
    } else {
        // Mot vertical
        const col = placements[0].col;
        const rows = placements.map(p => p.row);
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);

        // Étendre en haut
        let startRow = minRow;
        while (startRow > 0 && gameState.board[startRow - 1][col]) startRow--;

        // Étendre en bas
        let endRow = maxRow;
        while (endRow < 8 && gameState.board[endRow + 1][col]) endRow++;

        // Marquer toutes les positions du mot principal
        for (let row = startRow; row <= endRow; row++) {
            affectedPositions.add(`${row},${col}`);
        }

        // Pour chaque nouvelle lettre, chercher les mots perpendiculaires
        for (const placement of placements) {
            const perpPositions = getPerpendicularWordPositions(gameState.board, placement.row, placement.col, true);
            perpPositions.forEach(pos => affectedPositions.add(`${pos.row},${pos.col}`));
        }
    }

    // Changer la couleur de toutes les positions affectées
    for (const posStr of affectedPositions) {
        const [row, col] = posStr.split(',').map(Number);
        if (gameState.board[row][col]) {
            gameState.board[row][col].player = gameState.currentPlayer;
        }
    }
}

// Obtenir les positions du mot perpendiculaire à une position donnée
function getPerpendicularWordPositions(board, row, col, mainIsVertical) {
    const positions = [];

    if (mainIsVertical) {
        // Chercher horizontalement
        let startCol = col;
        while (startCol > 0 && board[row][startCol - 1]) startCol--;

        let endCol = col;
        while (endCol < 8 && board[row][endCol + 1]) endCol++;

        // Si le mot fait plus d'une lettre, ajouter toutes les positions
        if (startCol < endCol) {
            for (let c = startCol; c <= endCol; c++) {
                positions.push({ row, col: c });
            }
        }
    } else {
        // Chercher verticalement
        let startRow = row;
        while (startRow > 0 && board[startRow - 1][col]) startRow--;

        let endRow = row;
        while (endRow < 8 && board[endRow + 1][col]) endRow++;

        // Si le mot fait plus d'une lettre, ajouter toutes les positions
        if (startRow < endRow) {
            for (let r = startRow; r <= endRow; r++) {
                positions.push({ row: r, col });
            }
        }
    }

    return positions;
}

// Mettre à jour les scores
function updateScores() {
    // Compter les lettres de chaque joueur sur le plateau
    const counts = [0, 0, 0, 0];

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = gameState.board[row][col];
            if (cell) {
                counts[cell.player]++;
            }
        }
    }

    gameState.scores = counts;
}

// Vérifier les coins étoilés
function checkStarCorners() {
    const corners = [[0, 0], [0, 8], [8, 0], [8, 8]];

    for (const [row, col] of corners) {
        if (gameState.board[row][col]) {
            // Une étoile a été touchée - figer les scores et réinitialiser le plateau
            for (let i = 0; i < 4; i++) {
                gameState.frozenScores[i] += gameState.scores[i];
            }

            // Réinitialiser le plateau
            gameState.board = Array(9).fill(null).map(() => Array(9).fill(null));
            gameState.scores = [0, 0, 0, 0];
            gameState.mustUseCenterOnNextTurn = true;

            showMessage('⭐ Étoile atteinte ! Plateau réinitialisé, scores figés !');
            return;
        }
    }
}

// Joueur suivant
function nextPlayer() {
    gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;

    // Si c'est le tour d'une IA, la faire jouer après un court délai
    if (gameState.currentPlayer > 0 && !gameState.gameOver) {
        setTimeout(() => {
            playAITurn();
        }, 1000); // Délai de 1 seconde pour que le joueur humain puisse suivre
    }
}

// Faire jouer l'IA
function playAITurn() {
    if (gameState.gameOver) return;

    // Déterminer le niveau de difficulté selon le joueur
    let difficulty;
    switch (gameState.currentPlayer) {
        case 1: // Joueur 2
            difficulty = 'weak';
            break;
        case 2: // Joueur 3
            difficulty = 'medium';
            break;
        case 3: // Joueur 4
            difficulty = 'strong';
            break;
        default:
            return; // Joueur humain
    }

    // Obtenir le coup de l'IA
    const move = playAI(dictionary, gameState, difficulty);

    if (!move) {
        // L'IA ne peut pas jouer, elle passe
        showMessage(`${PLAYER_NAMES[gameState.currentPlayer]} passe.`);
        pass();
        return;
    }

    // Appliquer le coup de l'IA
    const usedIndices = new Set();
    gameState.temporaryPlacements = move.positions.map(pos => {
        // Trouver l'index de la lettre dans le chevalet, en évitant les indices déjà utilisés
        let rackIndex = -1;
        for (let i = 0; i < gameState.rack.length; i++) {
            if (gameState.rack[i] === pos.letter && !usedIndices.has(i)) {
                rackIndex = i;
                usedIndices.add(i);
                break;
            }
        }
        return {
            row: pos.row,
            col: pos.col,
            letter: pos.letter,
            rackIndex: rackIndex
        };
    });

    // Mettre à jour l'affichage pour montrer les lettres temporaires
    renderBoard();

    // Valider le coup après un court délai
    setTimeout(() => {
        validateMove();
    }, 500);
}

// Passer son tour
function pass() {
    if (gameState.temporaryPlacements.length > 0) {
        showMessage('Annulez votre coup avant de passer !');
        return;
    }

    gameState.passCount++;

    if (gameState.passCount >= 4) {
        // Tous les joueurs ont passé - vider et renouveler le chevalet
        gameState.rack = [];
        fillRack();
        gameState.passCount = 0;
        showMessage('Tous les joueurs ont passé. Nouveau chevalet !');
    }

    gameState.history.unshift({
        player: gameState.currentPlayer,
        words: '(Passe)',
        score: gameState.scores[gameState.currentPlayer] + gameState.frozenScores[gameState.currentPlayer]
    });

    nextPlayer();
    saveGameState();
    updateUI();
}

// Annuler le coup
function cancel() {
    gameState.temporaryPlacements = [];
    gameState.selectedTile = null;
    renderBoard();
    renderRack();
}

// Vérifier la fin de partie
function checkGameOver() {
    // Victoire à 25 points
    for (let i = 0; i < 4; i++) {
        if (gameState.scores[i] + gameState.frozenScores[i] >= 25) {
            endGame(`${PLAYER_NAMES[i]} gagne avec ${gameState.scores[i] + gameState.frozenScores[i]} points !`);
            return;
        }
    }

    // Pioche vide
    if (gameState.bag.length === 0 && gameState.rack.length === 0) {
        const totalScores = gameState.scores.map((s, i) => s + gameState.frozenScores[i]);
        const maxScore = Math.max(...totalScores);
        const winner = totalScores.indexOf(maxScore);
        endGame(`Pioche vide ! ${PLAYER_NAMES[winner]} gagne avec ${maxScore} points !`);
    }
}

// Fin de partie
function endGame(message) {
    gameState.gameOver = true;

    const modal = document.getElementById('gameOverModal');
    const finalScores = document.getElementById('finalScores');

    finalScores.innerHTML = '<h3>' + message + '</h3>';

    const totalScores = gameState.scores.map((s, i) => s + gameState.frozenScores[i]);
    const maxScore = Math.max(...totalScores);

    for (let i = 0; i < 4; i++) {
        const total = totalScores[i];
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'final-score ' + PLAYER_COLORS[i];
        if (total === maxScore) scoreDiv.classList.add('winner');
        scoreDiv.textContent = `${PLAYER_NAMES[i]}: ${total} points (Plateau: ${gameState.scores[i]}, Figé: ${gameState.frozenScores[i]})`;
        finalScores.appendChild(scoreDiv);
    }

    modal.classList.add('show');
}

// Mise à jour de l'interface
function updateUI() {
    // Scores
    for (let i = 0; i < 4; i++) {
        const card = document.querySelector(`.score-card.${PLAYER_COLORS[i]}`);
        const totalScore = gameState.scores[i] + gameState.frozenScores[i];
        card.querySelector('.score-value').textContent = totalScore;
        card.querySelector('.score-frozen').textContent = `${gameState.frozenScores[i]}`;

        if (i === gameState.currentPlayer && !gameState.gameOver) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    }

    // Lettres restantes
    document.getElementById('remainingTiles').textContent = `Lettres restantes: ${gameState.bag.length}`;

    // Désactiver les boutons si c'est le tour d'une IA
    const isAITurn = gameState.currentPlayer > 0 && !gameState.gameOver;
    document.getElementById('validateBtn').disabled = isAITurn;
    document.getElementById('passBtn').disabled = isAITurn;
    document.getElementById('cancelBtn').disabled = isAITurn;


    renderRack();

    // Afficher le tour du joueur
    showMessage('');
}

// === Gestion du Drag and Drop ===

let draggedTileIndex = null;
let draggedFromBoard = false; // Indique si on drag depuis le plateau
let draggedBoardPosition = null; // Position de la lettre sur le plateau

// Début du drag d'une tuile du chevalet
function handleDragStart(e) {
    if (gameState.gameOver || gameState.currentPlayer > 0) {
        e.preventDefault();
        return;
    }

    const tileElement = e.target;
    draggedTileIndex = parseInt(tileElement.dataset.index);
    draggedFromBoard = false;

    // Vérifier si la tuile est déjà utilisée
    const usedIndices = gameState.temporaryPlacements.map(p => p.rackIndex);
    if (usedIndices.includes(draggedTileIndex)) {
        e.preventDefault();
        return;
    }

    tileElement.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTileIndex);
}

// Début du drag d'une lettre temporaire depuis le plateau
function handleCellDragStart(e) {
    if (gameState.gameOver || gameState.currentPlayer > 0) {
        e.preventDefault();
        return;
    }

    const cellElement = e.target;
    const tempIndex = parseInt(cellElement.dataset.tempIndex);
    const temp = gameState.temporaryPlacements[tempIndex];

    if (temp) {
        draggedTileIndex = temp.rackIndex;
        draggedFromBoard = true;
        draggedBoardPosition = { row: temp.row, col: temp.col };

        cellElement.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ fromBoard: true, tempIndex }));
    }
}

// Fin du drag d'une cellule
function handleCellDragEnd(e) {
    e.target.classList.remove('dragging');
}

// Fin du drag d'une tuile du chevalet
function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedTileIndex = null;
    draggedFromBoard = false;
    draggedBoardPosition = null;
}

// Survol d'une cellule avec une tuile
function handleDragOver(e) {
    if (gameState.gameOver || gameState.currentPlayer > 0) return;
    if (draggedTileIndex === null) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const cell = e.currentTarget;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    // Si on drag depuis le plateau, ignorer la case d'origine
    if (draggedFromBoard && draggedBoardPosition &&
        draggedBoardPosition.row === row && draggedBoardPosition.col === col) {
        return;
    }

    // Vérifier si la case est vide (ou si c'est la case d'origine lors d'un drag depuis le plateau)
    const existingPlacement = gameState.temporaryPlacements.find(p => p.row === row && p.col === col);
    const boardContent = gameState.board[row][col];

    if (!existingPlacement && !boardContent) {
        cell.classList.add('drag-over');
    }
}

// Quitter le survol d'une cellule
function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

// Déposer une tuile sur une cellule
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (gameState.gameOver || gameState.currentPlayer > 0) return;
    if (draggedTileIndex === null) return;

    const cell = e.currentTarget;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    // Si on drag depuis le plateau, on doit d'abord retirer la lettre de sa position actuelle
    if (draggedFromBoard && draggedBoardPosition) {
        const tempIndex = gameState.temporaryPlacements.findIndex(
            p => p.row === draggedBoardPosition.row && p.col === draggedBoardPosition.col
        );
        if (tempIndex !== -1) {
            gameState.temporaryPlacements.splice(tempIndex, 1);
        }
    }

    // Vérifier si la case est vide
    const existingPlacement = gameState.temporaryPlacements.find(p => p.row === row && p.col === col);
    const boardContent = gameState.board[row][col];

    if (!existingPlacement && !boardContent) {
        // Placer la lettre
        const letter = gameState.rack[draggedTileIndex];
        gameState.temporaryPlacements.push({
            row,
            col,
            letter,
            rackIndex: draggedTileIndex
        });
        gameState.selectedTile = null;
        renderBoard();
        renderRack();
    } else if (draggedFromBoard) {
        // Si la case n'est pas vide et qu'on venait du plateau, remettre la lettre à sa place
        const letter = gameState.rack[draggedTileIndex];
        gameState.temporaryPlacements.push({
            row: draggedBoardPosition.row,
            col: draggedBoardPosition.col,
            letter,
            rackIndex: draggedTileIndex
        });
        renderBoard();
        renderRack();
    }

    draggedTileIndex = null;
    draggedFromBoard = false;
    draggedBoardPosition = null;
}

// Survol du chevalet avec une lettre du plateau
function handleRackDragOver(e) {
    if (gameState.gameOver || gameState.currentPlayer > 0) return;
    if (!draggedFromBoard) return; // On ne peut remettre que les lettres qui viennent du plateau

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// Déposer une lettre sur le chevalet (la retirer du plateau)
function handleRackDrop(e) {
    e.preventDefault();

    if (gameState.gameOver || gameState.currentPlayer > 0) return;
    if (!draggedFromBoard || !draggedBoardPosition) return;

    // Retirer la lettre du plateau
    const tempIndex = gameState.temporaryPlacements.findIndex(
        p => p.row === draggedBoardPosition.row && p.col === draggedBoardPosition.col
    );

    if (tempIndex !== -1) {
        gameState.temporaryPlacements.splice(tempIndex, 1);
        renderBoard();
        renderRack();
    }

    draggedTileIndex = null;
    draggedFromBoard = false;
    draggedBoardPosition = null;
}

// === Gestion du Touch (Mobile) ===

let touchedElement = null;
let touchClone = null;
let touchStartX = 0;
let touchStartY = 0;
let lastHighlightedCell = null; // Cache de la dernière cellule surlignée
let rafId = null; // ID pour requestAnimationFrame

// Début du touch sur une tuile du chevalet
function handleTileTouchStart(e) {
    if (gameState.gameOver || gameState.currentPlayer > 0) {
        e.preventDefault();
        return;
    }

    const tileElement = e.target;
    const tileIndex = parseInt(tileElement.dataset.index);

    // Vérifier si la tuile est déjà utilisée
    const usedIndices = gameState.temporaryPlacements.map(p => p.rackIndex);
    if (usedIndices.includes(tileIndex)) {
        return;
    }

    e.preventDefault(); // Empêcher le scroll

    touchedElement = tileElement;
    draggedTileIndex = tileIndex;
    draggedFromBoard = false;

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    // Créer un clone visuel de la tuile
    touchClone = tileElement.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.left = (touch.clientX - 32) + 'px';
    touchClone.style.top = (touch.clientY - 32) + 'px';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.opacity = '0.8';
    touchClone.style.zIndex = '10000';
    touchClone.style.transform = 'scale(1.1)';
    touchClone.style.transition = 'none'; // Désactiver les transitions pour plus de fluidité
    touchClone.style.willChange = 'transform'; // Optimisation GPU
    document.body.appendChild(touchClone);

    tileElement.style.opacity = '0.3';
}

// Début du touch sur une cellule du plateau
function handleCellTouchStart(e) {
    if (gameState.gameOver || gameState.currentPlayer > 0) {
        e.preventDefault();
        return;
    }

    const cellElement = e.target;
    const tempIndex = parseInt(cellElement.dataset.tempIndex);
    const temp = gameState.temporaryPlacements[tempIndex];

    if (!temp) return;

    e.preventDefault(); // Empêcher le scroll

    touchedElement = cellElement;
    draggedTileIndex = temp.rackIndex;
    draggedFromBoard = true;
    draggedBoardPosition = { row: temp.row, col: temp.col };

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    // Créer un clone visuel de la lettre
    touchClone = cellElement.cloneNode(true);
    touchClone.style.position = 'fixed';
    touchClone.style.left = (touch.clientX - 32) + 'px';
    touchClone.style.top = (touch.clientY - 32) + 'px';
    touchClone.style.pointerEvents = 'none';
    touchClone.style.opacity = '0.8';
    touchClone.style.zIndex = '10000';
    touchClone.style.transform = 'scale(1.1)';
    touchClone.style.transition = 'none'; // Désactiver les transitions
    touchClone.style.willChange = 'transform'; // Optimisation GPU
    document.body.appendChild(touchClone);

    cellElement.style.opacity = '0.3';
}

// Déplacement du touch (optimisé)
function handleTouchMove(e) {
    if (!touchClone) return;

    e.preventDefault(); // Empêcher le scroll

    const touch = e.touches[0];

    // Utiliser requestAnimationFrame pour des animations fluides
    if (rafId) {
        cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
        // Déplacer le clone avec transform pour de meilleures performances
        const x = touch.clientX - 32;
        const y = touch.clientY - 32;
        touchClone.style.transform = `translate(${x - parseInt(touchClone.style.left)}px, ${y - parseInt(touchClone.style.top)}px) scale(1.1)`;

        // Mettre en surbrillance la cellule survolée (optimisé)
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

        // Si c'est la même cellule que la dernière fois, ne rien faire
        if (elementBelow === lastHighlightedCell) {
            return;
        }

        // Retirer le highlight de l'ancienne cellule
        if (lastHighlightedCell) {
            lastHighlightedCell.classList.remove('drag-over');
        }

        lastHighlightedCell = null;

        if (elementBelow && elementBelow.classList.contains('cell')) {
            const row = parseInt(elementBelow.dataset.row);
            const col = parseInt(elementBelow.dataset.col);

            // Vérifier si la case est vide
            const existingPlacement = gameState.temporaryPlacements.find(p => p.row === row && p.col === col);
            const boardContent = gameState.board[row][col];

            if (!existingPlacement && !boardContent) {
                elementBelow.classList.add('drag-over');
                lastHighlightedCell = elementBelow;
            }
        }
    });
}

// Fin du touch
function handleTouchEnd(e) {
    if (!touchClone) return;

    e.preventDefault();

    // Annuler requestAnimationFrame en cours
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

    // Nettoyer le clone
    if (touchClone) {
        touchClone.remove();
        touchClone = null;
    }

    // Restaurer l'opacité de l'élément touché
    if (touchedElement) {
        touchedElement.style.opacity = '';
    }

    // Retirer tous les highlights (optimisé)
    if (lastHighlightedCell) {
        lastHighlightedCell.classList.remove('drag-over');
        lastHighlightedCell = null;
    }

    // Vérifier si on a lâché sur une cellule
    if (elementBelow && elementBelow.classList.contains('cell')) {
        const row = parseInt(elementBelow.dataset.row);
        const col = parseInt(elementBelow.dataset.col);

        // Si on drag depuis le plateau, on doit d'abord retirer la lettre de sa position actuelle
        if (draggedFromBoard && draggedBoardPosition) {
            const tempIndex = gameState.temporaryPlacements.findIndex(
                p => p.row === draggedBoardPosition.row && p.col === draggedBoardPosition.col
            );
            if (tempIndex !== -1) {
                gameState.temporaryPlacements.splice(tempIndex, 1);
            }
        }

        // Vérifier si la case est vide
        const existingPlacement = gameState.temporaryPlacements.find(p => p.row === row && p.col === col);
        const boardContent = gameState.board[row][col];

        if (!existingPlacement && !boardContent) {
            // Placer la lettre
            const letter = gameState.rack[draggedTileIndex];
            gameState.temporaryPlacements.push({
                row,
                col,
                letter,
                rackIndex: draggedTileIndex
            });
            gameState.selectedTile = null;
            renderBoard();
            renderRack();
        } else if (draggedFromBoard) {
            // Si la case n'est pas vide et qu'on venait du plateau, remettre la lettre à sa place
            const letter = gameState.rack[draggedTileIndex];
            gameState.temporaryPlacements.push({
                row: draggedBoardPosition.row,
                col: draggedBoardPosition.col,
                letter,
                rackIndex: draggedTileIndex
            });
            renderBoard();
            renderRack();
        }
    }
    // Vérifier si on a lâché sur le chevalet (pour remettre une lettre)
    else if (draggedFromBoard && elementBelow &&
             (elementBelow.id === 'rack' || elementBelow.closest('#rack'))) {
        // Retirer la lettre du plateau
        const tempIndex = gameState.temporaryPlacements.findIndex(
            p => p.row === draggedBoardPosition.row && p.col === draggedBoardPosition.col
        );

        if (tempIndex !== -1) {
            gameState.temporaryPlacements.splice(tempIndex, 1);
            renderBoard();
            renderRack();
        }
    }
    // Si on n'a pas lâché sur une cible valide et qu'on venait du plateau, remettre la lettre
    else if (draggedFromBoard && draggedBoardPosition) {
        const letter = gameState.rack[draggedTileIndex];
        gameState.temporaryPlacements.push({
            row: draggedBoardPosition.row,
            col: draggedBoardPosition.col,
            letter,
            rackIndex: draggedTileIndex
        });
        renderBoard();
        renderRack();
    }

    // Réinitialiser les variables
    touchedElement = null;
    draggedTileIndex = null;
    draggedFromBoard = false;
    draggedBoardPosition = null;
}

// Afficher un message
function showMessage(message) {
    const msgEl = document.getElementById('gameMessage');
    const playerTurn = gameState.gameOver ? 'Partie terminée' : `Tour du ${PLAYER_NAMES[gameState.currentPlayer]}`;

    if (message) {
        msgEl.textContent = `${playerTurn} - ${message}`;
        setTimeout(() => {
            msgEl.textContent = playerTurn;
        }, 3000);
    } else {
        msgEl.textContent = playerTurn;
    }
}

// Surligner les erreurs
function highlightErrors() {
    const cells = document.querySelectorAll('.cell.temporary');
    cells.forEach(cell => {
        cell.classList.add('error');
        setTimeout(() => cell.classList.remove('error'), 1000);
    });
}

// Configuration des événements
function setupEventListeners() {
    document.getElementById('newGameBtn').addEventListener('click', () => {
        if (confirm('Quitter la partie en cours et commencer une nouvelle partie ?')) {
            newGame();
        }
    });

    document.getElementById('validateBtn').addEventListener('click', validateMove);
    document.getElementById('passBtn').addEventListener('click', pass);
    document.getElementById('cancelBtn').addEventListener('click', cancel);

    document.getElementById('newGameFromModal').addEventListener('click', newGame);
}

// Démarrage
init();

