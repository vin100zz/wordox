/*
 * Wordox - moteur de règles.
 * Aucune dépendance au DOM : utilisé par l'interface, le worker de l'IA et les tests Node.
 */
(function (root) {
    'use strict';

    var SIZE = 9;
    var CELLS = SIZE * SIZE;
    var CENTER = 4 * SIZE + 4;
    var RACK_SIZE = 6;
    var DEFAULT_TARGET = 25;
    var VOWELS = 'AEIOUY';

    // Distribution des lettres du sac (proche des fréquences du français).
    var DISTRIBUTION = {
        E: 35, A: 20, I: 18, S: 16, N: 15, R: 14, T: 14,
        O: 13, L: 12, U: 12, D: 7, M: 6, P: 5, C: 5,
        B: 3, V: 3, H: 3, F: 3, G: 3, Q: 2, J: 2,
        X: 1, Y: 1, Z: 1, K: 1, W: 1
    };

    var ERRORS = {
        empty: 'Placez au moins une lettre.',
        occupied: 'Cette case est déjà occupée.',
        line: 'Les lettres doivent être sur une même ligne ou colonne.',
        gap: 'Les lettres doivent former un mot sans trou.',
        short: 'Un mot doit faire au moins 2 lettres.',
        center: 'Le premier mot doit passer par la case centrale.',
        touch: 'Le mot doit toucher des lettres déjà posées.',
        rack: 'Ces lettres ne sont pas sur votre chevalet.',
        turn: 'Ce n\'est pas votre tour.',
        over: 'La partie est terminée.'
    };

    function isStar(i) {
        var r = (i / SIZE) | 0, c = i % SIZE;
        return (r === 0 || r === SIZE - 1) && (c === 0 || c === SIZE - 1);
    }

    function shuffle(a, rng) {
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rng() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function makeBag(rng) {
        var bag = [];
        for (var l in DISTRIBUTION) {
            for (var n = 0; n < DISTRIBUTION[l]; n++) bag.push(l);
        }
        return shuffle(bag, rng || Math.random);
    }

    function isVowel(l) { return VOWELS.indexOf(l) >= 0; }

    // Complète le chevalet, en évitant les tirages sans voyelle ou sans consonne :
    // seules les lettres qui viennent d'être tirées peuvent être remises dans le sac.
    function fillRack(state, p, rng) {
        rng = rng || Math.random;
        var rack = state.racks[p];
        var firstNew = rack.length;
        while (rack.length < RACK_SIZE) {
            if (!state.bag.length) state.bag = makeBag(rng);
            rack.push(state.bag.pop());
        }
        for (var tries = 0; tries < 4; tries++) {
            var vowels = 0;
            for (var i = 0; i < rack.length; i++) if (isVowel(rack[i])) vowels++;
            var wantVowel;
            if (vowels < 2) wantVowel = true;
            else if (rack.length - vowels < 2) wantVowel = false;
            else break;
            var from = -1;
            for (i = firstNew; i < rack.length; i++) {
                if (isVowel(rack[i]) !== wantVowel) { from = i; break; }
            }
            if (from < 0) break;
            var inBag = -1;
            for (i = state.bag.length - 1; i >= 0; i--) {
                if (isVowel(state.bag[i]) === wantVowel) { inBag = i; break; }
            }
            if (inBag < 0) break;
            var t = rack[from]; rack[from] = state.bag[inBag]; state.bag[inBag] = t;
        }
    }

    /*
     * players : [{ name, kind: 'human' | 'ai' | 'remote', level }]
     */
    function createGame(players, target, rng) {
        rng = rng || Math.random;
        var state = {
            letters: [],
            owners: [],
            racks: [],
            bag: makeBag(rng),
            banked: [],
            players: players,
            current: Math.floor(rng() * players.length),
            passes: 0,
            turn: 0,
            target: target || DEFAULT_TARGET,
            over: false,
            winners: [],
            last: null
        };
        for (var i = 0; i < CELLS; i++) { state.letters.push(''); state.owners.push(-1); }
        for (var p = 0; p < players.length; p++) {
            state.racks.push([]);
            state.banked.push(0);
            fillRack(state, p, rng);
        }
        return state;
    }

    function boardCount(state, p) {
        var n = 0;
        for (var i = 0; i < CELLS; i++) if (state.owners[i] === p) n++;
        return n;
    }

    function score(state, p) {
        return state.banked[p] + boardCount(state, p);
    }

    function isBoardEmpty(letters) {
        for (var i = 0; i < CELLS; i++) if (letters[i]) return false;
        return true;
    }

    // Mot contenant la case i dans la direction step (1 = horizontal, SIZE = vertical).
    function wordAt(grid, i, step) {
        var r = (i / SIZE) | 0, c = i % SIZE;
        var pos = step === 1 ? c : r;
        var start = i, end = i, p = pos;
        while (p > 0 && grid[start - step]) { start -= step; p--; }
        p = pos;
        while (p < SIZE - 1 && grid[end + step]) { end += step; p++; }
        var cells = [], word = '';
        for (var k = start; k <= end; k += step) { cells.push(k); word += grid[k]; }
        return { word: word, cells: cells };
    }

    /*
     * Analyse géométrique d'un coup. placements : [{ i: case, l: lettre }]
     * Retourne { ok, code, error } ou { ok: true, words: [{word, cells}], cells: [...], star }
     * La validité des mots dans le dictionnaire n'est pas vérifiée ici.
     */
    function findWords(letters, placements) {
        function fail(code) { return { ok: false, code: code, error: ERRORS[code] }; }
        if (!placements || !placements.length) return fail('empty');

        var grid = letters.slice();
        var placed = {};
        var k, pl;
        for (k = 0; k < placements.length; k++) {
            pl = placements[k];
            if (!(pl.i >= 0 && pl.i < CELLS) || grid[pl.i]) return fail('occupied');
            grid[pl.i] = pl.l;
            placed[pl.i] = true;
        }

        var r0 = (placements[0].i / SIZE) | 0, c0 = placements[0].i % SIZE;
        var sameRow = true, sameCol = true, min = placements[0].i, max = placements[0].i;
        for (k = 1; k < placements.length; k++) {
            var i = placements[k].i;
            if (((i / SIZE) | 0) !== r0) sameRow = false;
            if (i % SIZE !== c0) sameCol = false;
            if (i < min) min = i;
            if (i > max) max = i;
        }
        if (!sameRow && !sameCol) return fail('line');

        var words = [];
        if (placements.length === 1) {
            var h = wordAt(grid, min, 1), v = wordAt(grid, min, SIZE);
            if (h.word.length > 1) words.push(h);
            if (v.word.length > 1) words.push(v);
        } else {
            var step = sameRow ? 1 : SIZE;
            for (k = min; k <= max; k += step) if (!grid[k]) return fail('gap');
            words.push(wordAt(grid, min, step));
            var cross = sameRow ? SIZE : 1;
            for (k = 0; k < placements.length; k++) {
                var w = wordAt(grid, placements[k].i, cross);
                if (w.word.length > 1) words.push(w);
            }
        }

        var empty = isBoardEmpty(letters);
        if (empty && !placed[CENTER]) return fail('center');
        if (!words.length) return fail(empty ? 'short' : 'touch');

        var seen = {}, cells = [], touches = false, star = false;
        for (k = 0; k < words.length; k++) {
            for (var n = 0; n < words[k].cells.length; n++) {
                var cell = words[k].cells[n];
                if (!placed[cell]) touches = true;
                if (!seen[cell]) { seen[cell] = true; cells.push(cell); }
            }
        }
        if (!empty && !touches) return fail('touch');
        for (k = 0; k < placements.length; k++) if (isStar(placements[k].i)) star = true;

        return { ok: true, words: words, cells: cells, star: star };
    }

    // Analyse complète : géométrie + dictionnaire. isWord : function (mot) -> booléen
    function checkMove(letters, placements, isWord) {
        var res = findWords(letters, placements);
        if (!res.ok) return res;
        var bad = [];
        for (var k = 0; k < res.words.length; k++) {
            if (!isWord(res.words[k].word)) bad.push(res.words[k].word);
        }
        if (bad.length) {
            return {
                ok: false, code: 'invalid', invalid: bad, words: res.words,
                error: bad.length === 1 ? bad[0] + ' n\'est pas dans le dictionnaire.'
                    : bad.join(', ') + ' ne sont pas dans le dictionnaire.'
            };
        }
        return res;
    }

    function takeFromRack(rack, wanted) {
        var copy = rack.slice();
        for (var k = 0; k < wanted.length; k++) {
            var at = copy.indexOf(wanted[k]);
            if (at < 0) return null;
            copy.splice(at, 1);
        }
        return copy;
    }

    function nextPlayer(state) {
        state.current = (state.current + 1) % state.players.length;
        state.turn++;
    }

    /*
     * Joue un coup pour le joueur courant. Modifie state.
     * Retourne { ok: true } ou { ok: false, error }.
     */
    function applyMove(state, placements, isWord, rng) {
        if (state.over) return { ok: false, code: 'over', error: ERRORS.over };
        var p = state.current;
        var rest = takeFromRack(state.racks[p], placements.map(function (pl) { return pl.l; }));
        if (!rest) return { ok: false, code: 'rack', error: ERRORS.rack };
        var res = checkMove(state.letters, placements, isWord);
        if (!res.ok) return res;

        var k, n = state.players.length;
        for (k = 0; k < placements.length; k++) state.letters[placements[k].i] = placements[k].l;
        var stolen = [], gained = 0;
        for (k = 0; k < n; k++) stolen.push(0);
        for (k = 0; k < res.cells.length; k++) {
            var owner = state.owners[res.cells[k]];
            if (owner !== p) {
                gained++;
                if (owner >= 0) stolen[owner]++;
            }
            state.owners[res.cells[k]] = p;
        }
        state.racks[p] = rest;
        state.passes = 0;
        state.last = {
            type: 'move', player: p,
            placements: placements.map(function (pl) { return { i: pl.i, l: pl.l }; }),
            words: res.words.map(function (w) { return w.word; }),
            cells: res.cells, gained: gained, stolen: stolen, star: res.star
        };

        if (res.star) {
            // Coin étoilé : les points du plateau sont figés et le plateau est vidé.
            for (k = 0; k < n; k++) state.banked[k] += boardCount(state, k);
            for (k = 0; k < CELLS; k++) { state.letters[k] = ''; state.owners[k] = -1; }
        }

        if (score(state, p) >= state.target) {
            state.over = true;
            state.winners = [p];
            return { ok: true };
        }
        fillRack(state, p, rng);
        nextPlayer(state);
        return { ok: true };
    }

    /*
     * Passe le tour, en échangeant éventuellement des lettres du chevalet.
     */
    function applyPass(state, swap, rng) {
        if (state.over) return { ok: false, code: 'over', error: ERRORS.over };
        rng = rng || Math.random;
        var p = state.current;
        swap = swap || [];
        if (swap.length) {
            var rest = takeFromRack(state.racks[p], swap);
            if (!rest) return { ok: false, code: 'rack', error: ERRORS.rack };
            state.racks[p] = rest;
            fillRack(state, p, rng);
            for (var k = 0; k < swap.length; k++) {
                state.bag.splice(Math.floor(rng() * (state.bag.length + 1)), 0, swap[k]);
            }
        }
        state.passes++;
        state.last = { type: 'pass', player: p, swapped: swap.length };
        if (state.passes >= 2 * state.players.length) {
            // Tout le monde a passé deux fois de suite : le meilleur score l'emporte.
            var best = -1, winners = [];
            for (var q = 0; q < state.players.length; q++) {
                var s = score(state, q);
                if (s > best) { best = s; winners = [q]; }
                else if (s === best) winners.push(q);
            }
            state.over = true;
            state.winners = winners;
            return { ok: true };
        }
        nextPlayer(state);
        return { ok: true };
    }

    // Copie de l'état pour un joueur distant : les autres chevalets et le sac sont masqués.
    function viewFor(state, seat) {
        var view = JSON.parse(JSON.stringify(state));
        view.bag = [];
        for (var p = 0; p < view.racks.length; p++) {
            if (p !== seat) view.racks[p] = view.racks[p].map(function () { return '?'; });
        }
        return view;
    }

    var Rules = {
        SIZE: SIZE, CELLS: CELLS, CENTER: CENTER, RACK_SIZE: RACK_SIZE,
        DEFAULT_TARGET: DEFAULT_TARGET, DISTRIBUTION: DISTRIBUTION, ERRORS: ERRORS,
        isStar: isStar, isVowel: isVowel, shuffle: shuffle, makeBag: makeBag,
        createGame: createGame, fillRack: fillRack,
        boardCount: boardCount, score: score, isBoardEmpty: isBoardEmpty,
        findWords: findWords, checkMove: checkMove,
        applyMove: applyMove, applyPass: applyPass, viewFor: viewFor
    };

    root.Wordox = root.Wordox || {};
    root.Wordox.Rules = Rules;
    if (typeof module !== 'undefined' && module.exports) module.exports = Rules;
})(typeof self !== 'undefined' ? self : this);
