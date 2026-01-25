// Système d'IA pour Wordox
// Joueur 2 : Faible
// Joueur 3 : Moyen
// Joueur 4 : Fort

class WordoxAI {
    constructor(dictionary, gameState) {
        this.dictionary = dictionary;
        this.gameState = gameState;
    }

    // Trouver tous les coups possibles
    findAllPossibleMoves() {
        const moves = [];
        const rack = this.gameState.rack;
        const board = this.gameState.board;

        // Si premier coup ou après reset, chercher des mots qui passent par le centre
        if (this.gameState.mustUseCenterOnNextTurn) {
            moves.push(...this.findCenterMoves());
        } else {
            // Chercher tous les emplacements valides (adjacent aux lettres existantes)
            moves.push(...this.findAdjacentMoves());
        }

        return moves;
    }

    // Trouver les coups passant par le centre
    findCenterMoves() {
        const moves = [];
        const rack = this.gameState.rack;

        // Essayer des mots horizontaux passant par (4,4)
        for (let startCol = 0; startCol <= 4; startCol++) {
            for (let length = 2; length <= Math.min(6, 9 - startCol); length++) {
                if (startCol + length > 4) { // Le mot doit chevaucher le centre
                    moves.push(...this.tryPlaceWord(4, startCol, length, true));
                }
            }
        }

        // Essayer des mots verticaux passant par (4,4)
        for (let startRow = 0; startRow <= 4; startRow++) {
            for (let length = 2; length <= Math.min(6, 9 - startRow); length++) {
                if (startRow + length > 4) { // Le mot doit chevaucher le centre
                    moves.push(...this.tryPlaceWord(startRow, 4, length, false));
                }
            }
        }

        return moves;
    }

    // Trouver les coups adjacents aux lettres existantes
    findAdjacentMoves() {
        const moves = [];
        const board = this.gameState.board;

        // Pour chaque case du plateau
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col]) {
                    // Essayer de placer des mots horizontalement autour de cette lettre
                    moves.push(...this.findMovesAroundPosition(row, col, true));
                    // Essayer de placer des mots verticalement autour de cette lettre
                    moves.push(...this.findMovesAroundPosition(row, col, false));
                }
            }
        }

        return moves;
    }

    // Trouver les coups autour d'une position donnée
    findMovesAroundPosition(row, col, horizontal) {
        const moves = [];

        if (horizontal) {
            // Essayer de placer des mots horizontaux qui touchent cette position
            for (let startCol = Math.max(0, col - 5); startCol <= col; startCol++) {
                for (let length = 2; length <= Math.min(6, 9 - startCol); length++) {
                    const endCol = startCol + length - 1;
                    if (endCol >= col) { // Le mot touche ou chevauche la position
                        moves.push(...this.tryPlaceWord(row, startCol, length, true));
                    }
                }
            }
        } else {
            // Essayer de placer des mots verticaux qui touchent cette position
            for (let startRow = Math.max(0, row - 5); startRow <= row; startRow++) {
                for (let length = 2; length <= Math.min(6, 9 - startRow); length++) {
                    const endRow = startRow + length - 1;
                    if (endRow >= row) { // Le mot touche ou chevauche la position
                        moves.push(...this.tryPlaceWord(startRow, col, length, false));
                    }
                }
            }
        }

        return moves;
    }

    // Essayer de placer un mot à une position donnée
    tryPlaceWord(startRow, startCol, length, horizontal) {
        const moves = [];
        const rack = this.gameState.rack;
        const board = this.gameState.board;

        // Construire le pattern avec les lettres existantes
        const pattern = [];
        const positions = [];

        for (let i = 0; i < length; i++) {
            const row = horizontal ? startRow : startRow + i;
            const col = horizontal ? startCol + i : startCol;

            if (row >= 9 || col >= 9) return moves;

            positions.push({ row, col });

            if (board[row][col]) {
                pattern.push({ letter: board[row][col].letter, fixed: true });
            } else {
                pattern.push({ letter: null, fixed: false });
            }
        }

        // Générer toutes les combinaisons possibles avec les lettres du chevalet
        const emptySlots = pattern.filter(p => !p.fixed).length;
        if (emptySlots === 0 || emptySlots > rack.length) return moves;

        // Essayer de trouver des mots valides
        const validWords = this.findWordsMatchingPattern(pattern, rack);

        for (const wordInfo of validWords) {
            const move = {
                word: wordInfo.word,
                positions: positions.map((pos, idx) => ({
                    ...pos,
                    letter: wordInfo.word[idx],
                    isNew: !pattern[idx].fixed
                })).filter(p => p.isNew),
                horizontal,
                score: this.estimateMoveScore(wordInfo.word, positions, horizontal)
            };

            // Vérifier que le coup est valide (connexion)
            if (this.isValidMove(move)) {
                // Vérifier que TOUS les mots formés sont valides
                if (this.areAllFormedWordsValid(move)) {
                    moves.push(move);
                }
            }
        }

        return moves;
    }

    // Vérifier que tous les mots formés par un coup sont valides
    areAllFormedWordsValid(move) {
        // Simuler le placement sur un plateau temporaire
        const tempBoard = this.gameState.board.map(row => [...row]);
        for (const pos of move.positions) {
            tempBoard[pos.row][pos.col] = {
                letter: pos.letter,
                player: this.gameState.currentPlayer
            };
        }

        // Récupérer tous les mots formés
        const words = this.getAllFormedWordsForMove(tempBoard, move);

        // Vérifier que tous les mots sont dans le dictionnaire et font au moins 2 lettres
        for (const word of words) {
            if (word.length < 2) return false;
            if (!this.dictionary.includes(word)) return false;
        }

        return true;
    }

    // Récupérer tous les mots formés par un placement
    getAllFormedWordsForMove(board, move) {
        const words = [];

        // Trouver le mot principal
        const mainWord = this.getMainWordForMove(board, move);
        if (mainWord && mainWord.length > 1) {
            words.push(mainWord);
        }

        // Trouver les mots perpendiculaires pour chaque nouvelle lettre
        for (const pos of move.positions) {
            const perpWord = this.getPerpendicularWordAt(board, pos.row, pos.col, move.horizontal);
            if (perpWord && perpWord.length > 1) {
                words.push(perpWord);
            }
        }

        return words;
    }

    // Obtenir le mot principal d'un placement
    getMainWordForMove(board, move) {
        if (move.positions.length === 0) return null;

        if (move.horizontal) {
            const row = move.positions[0].row;
            let startCol = Math.min(...move.positions.map(p => p.col));
            let endCol = Math.max(...move.positions.map(p => p.col));

            // Étendre à gauche
            while (startCol > 0 && board[row][startCol - 1]) startCol--;

            // Étendre à droite
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
            const col = move.positions[0].col;
            let startRow = Math.min(...move.positions.map(p => p.row));
            let endRow = Math.max(...move.positions.map(p => p.row));

            // Étendre en haut
            while (startRow > 0 && board[startRow - 1][col]) startRow--;

            // Étendre en bas
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

    // Obtenir le mot perpendiculaire à une position
    getPerpendicularWordAt(board, row, col, mainIsHorizontal) {
        if (mainIsHorizontal) {
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
            return word.length > 1 ? word : null;
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
            return word.length > 1 ? word : null;
        }
    }

    // Trouver les mots correspondant à un pattern
    findWordsMatchingPattern(pattern, availableLetters) {
        const validWords = [];
        const patternString = pattern.map(p => p.fixed ? p.letter : '.').join('');
        const emptyCount = pattern.filter(p => !p.fixed).length;

        // Filtrer les mots du dictionnaire qui correspondent au pattern
        for (const word of this.dictionary) {
            if (word.length !== pattern.length) continue;

            // Vérifier que le mot correspond au pattern
            let matches = true;
            const neededLetters = [];

            for (let i = 0; i < pattern.length; i++) {
                if (pattern[i].fixed) {
                    if (word[i] !== pattern[i].letter) {
                        matches = false;
                        break;
                    }
                } else {
                    neededLetters.push(word[i]);
                }
            }

            if (!matches) continue;

            // Vérifier qu'on a les lettres nécessaires dans le chevalet
            if (this.hasLetters(neededLetters, availableLetters)) {
                validWords.push({ word, neededLetters });
            }
        }

        return validWords;
    }

    // Vérifier si on a les lettres nécessaires
    hasLetters(needed, available) {
        const availableCopy = [...available];
        for (const letter of needed) {
            const index = availableCopy.indexOf(letter);
            if (index === -1) return false;
            availableCopy.splice(index, 1);
        }
        return true;
    }

    // Vérifier si un coup est valide
    isValidMove(move) {
        // Vérifier que toutes les positions sont vides
        for (const pos of move.positions) {
            if (this.gameState.board[pos.row][pos.col]) return false;
        }

        // Vérifier la connexion
        if (this.gameState.mustUseCenterOnNextTurn) {
            return move.positions.some(p => p.row === 4 && p.col === 4);
        } else {
            // Vérifier qu'au moins une position touche une lettre existante
            for (const pos of move.positions) {
                const neighbors = [
                    [pos.row - 1, pos.col],
                    [pos.row + 1, pos.col],
                    [pos.row, pos.col - 1],
                    [pos.row, pos.col + 1]
                ];

                for (const [r, c] of neighbors) {
                    if (r >= 0 && r < 9 && c >= 0 && c < 9 && this.gameState.board[r][c]) {
                        return true;
                    }
                }
            }
            return false;
        }
    }

    // Estimer le score d'un coup
    estimateMoveScore(word, positions, horizontal) {
        // Score de base : nombre de lettres du mot
        let score = word.length;

        // Bonus pour les mots longs
        if (word.length >= 5) score += 2;
        if (word.length >= 6) score += 3;

        // Bonus si on touche un coin étoilé (reset mais points figés)
        const corners = [[0, 0], [0, 8], [8, 0], [8, 8]];
        for (const pos of positions) {
            if (corners.some(c => c[0] === pos.row && c[1] === pos.col)) {
                score += 10; // Bonus pour déclencher un reset
            }
        }

        // Bonus pour capturer des lettres adverses (simulé)
        score += this.estimateCapturedTiles(positions, horizontal);

        return score;
    }

    // Estimer le nombre de tuiles capturées
    estimateCapturedTiles(positions, horizontal) {
        let captured = 0;
        const board = this.gameState.board;

        // Compter les lettres adjacentes qui seront capturées
        for (const pos of positions) {
            // Vérifier dans la direction du mot
            if (horizontal) {
                if (pos.col > 0 && board[pos.row][pos.col - 1]) captured++;
                if (pos.col < 8 && board[pos.row][pos.col + 1]) captured++;
            } else {
                if (pos.row > 0 && board[pos.row - 1][pos.col]) captured++;
                if (pos.row < 8 && board[pos.row + 1][pos.col]) captured++;
            }

            // Vérifier dans la direction perpendiculaire
            if (horizontal) {
                if (pos.row > 0 && board[pos.row - 1][pos.col]) captured++;
                if (pos.row < 8 && board[pos.row + 1][pos.col]) captured++;
            } else {
                if (pos.col > 0 && board[pos.row][pos.col - 1]) captured++;
                if (pos.col < 8 && board[pos.row][pos.col + 1]) captured++;
            }
        }

        return captured;
    }

    // IA Faible (Joueur 2) : Joue le premier coup valide trouvé
    playWeak() {
        const moves = this.findAllPossibleMoves();
        if (moves.length === 0) return null;

        // Jouer le premier coup trouvé (ou un coup aléatoire parmi les premiers)
        const randomIndex = Math.floor(Math.random() * Math.min(5, moves.length));
        return moves[randomIndex];
    }

    // IA Moyenne (Joueur 3) : Joue un coup décent
    playMedium() {
        const moves = this.findAllPossibleMoves();
        if (moves.length === 0) return null;

        // Trier par score et prendre un coup dans le top 30%
        moves.sort((a, b) => b.score - a.score);
        const topMoves = moves.slice(0, Math.max(1, Math.floor(moves.length * 0.3)));
        const randomIndex = Math.floor(Math.random() * topMoves.length);
        return topMoves[randomIndex];
    }

    // IA Forte (Joueur 4) : Joue le meilleur coup
    playStrong() {
        const moves = this.findAllPossibleMoves();
        if (moves.length === 0) return null;

        // Trier par score et prendre le meilleur (ou parmi les 3 meilleurs)
        moves.sort((a, b) => b.score - a.score);
        const bestMoves = moves.slice(0, Math.min(3, moves.length));
        const randomIndex = Math.floor(Math.random() * bestMoves.length);
        return bestMoves[randomIndex];
    }

    // Jouer selon le niveau
    play(difficulty) {
        switch (difficulty) {
            case 'weak':
                return this.playWeak();
            case 'medium':
                return this.playMedium();
            case 'strong':
                return this.playStrong();
            default:
                return null;
        }
    }
}

// Fonction pour faire jouer l'IA
function playAI(dictionary, gameState, difficulty) {
    const ai = new WordoxAI(dictionary, gameState);
    return ai.play(difficulty);
}

