/*
 * Wordox - intelligence artificielle.
 * Génération de tous les coups jouables (arbre lexical + contraintes croisées),
 * puis choix d'un coup selon le niveau (1 à 10).
 *
 * Le niveau agit sur deux choses :
 *  - le vocabulaire : une IA ne joue que les mots dont le niveau est <= au sien ;
 *  - le jugement : part des coups "vus", bruit, prise en compte des vols, des étoiles,
 *    du reliquat et, pour les meilleurs, de la riposte adverse.
 */
(function (root) {
    'use strict';

    var Rules = (root.Wordox && root.Wordox.Rules) || require('./rules.js');
    var SIZE = Rules.SIZE, CELLS = Rules.CELLS, CENTER = Rules.CENTER;
    var ALL_LETTERS = (1 << 26) - 1;

    /*
     * see      : probabilité de repérer un coup donné
     * noise    : écart-type du bruit ajouté à l'évaluation
     * capture  : poids des cases reprises (par rapport aux lettres posées)
     * steal    : poids du tort causé aux adversaires
     * star     : poids de l'intérêt (ou du danger) de vider le plateau
     * leave    : poids de la qualité des lettres gardées
     * look     : [nombre de coups candidats, nombre de chevalets adverses simulés]
     */
    var LEVELS = [
        null,
        { see: 0.10, noise: 2.5, capture: 0.30, steal: 0.00, star: 0.00, leave: 0.0, look: null },
        { see: 0.14, noise: 2.3, capture: 0.40, steal: 0.00, star: 0.00, leave: 0.0, look: null },
        { see: 0.19, noise: 2.1, capture: 0.50, steal: 0.10, star: 0.10, leave: 0.0, look: null },
        { see: 0.25, noise: 1.9, capture: 0.60, steal: 0.20, star: 0.20, leave: 0.0, look: null },
        { see: 0.32, noise: 1.6, capture: 0.70, steal: 0.30, star: 0.35, leave: 0.1, look: null },
        { see: 0.40, noise: 1.3, capture: 0.80, steal: 0.40, star: 0.50, leave: 0.2, look: null },
        { see: 0.50, noise: 1.0, capture: 0.90, steal: 0.55, star: 0.70, leave: 0.3, look: null },
        { see: 0.65, noise: 0.6, capture: 1.00, steal: 0.75, star: 0.90, leave: 0.4, look: [6, 2] },
        { see: 0.82, noise: 0.3, capture: 1.00, steal: 0.90, star: 1.00, leave: 0.5, look: [8, 2] },
        { see: 1.00, noise: 0.0, capture: 1.00, steal: 1.00, star: 1.00, leave: 0.5, look: [10, 3] }
    ];

    // Intérêt de garder une lettre pour le coup suivant.
    var LEAVE = {
        E: 0.4, S: 0.5, A: 0.3, I: 0.2, R: 0.3, T: 0.3, N: 0.2, L: 0.1, O: 0, U: -0.1,
        D: 0, M: 0, P: 0, C: 0, B: -0.2, V: -0.3, H: -0.4, F: -0.3, G: -0.3,
        Q: -1.2, J: -0.6, X: -0.5, Y: -0.5, Z: -0.6, K: -0.8, W: -1.0
    };

    // ---------------------------------------------------------------- arbre lexical

    function buildTrie(dict) {
        var cap = 1 << 19;
        var letter = new Uint8Array(cap), term = new Uint8Array(cap), minLevel = new Uint8Array(cap);
        var child = new Int32Array(cap), next = new Int32Array(cap);
        var count = 1;

        function grow() {
            cap *= 2;
            var l = new Uint8Array(cap); l.set(letter); letter = l;
            var t = new Uint8Array(cap); t.set(term); term = t;
            var m = new Uint8Array(cap); m.set(minLevel); minLevel = m;
            var c = new Int32Array(cap); c.set(child); child = c;
            var n = new Int32Array(cap); n.set(next); next = n;
        }

        dict.levels.forEach(function (level, word) {
            var node = 0;
            for (var i = 0; i < word.length; i++) {
                var code = word.charCodeAt(i) - 65;
                var k = child[node], found = 0;
                while (k) {
                    if (letter[k] === code) { found = k; break; }
                    k = next[k];
                }
                if (!found) {
                    if (count === cap) grow();
                    found = count++;
                    letter[found] = code;
                    next[found] = child[node];
                    child[node] = found;
                    minLevel[found] = level;
                } else if (level < minLevel[found]) {
                    minLevel[found] = level;
                }
                node = found;
            }
            term[node] = level;
        });

        return { letter: letter, term: term, minLevel: minLevel, child: child, next: next, count: count };
    }

    // ---------------------------------------------------------------- génération

    /*
     * Tous les coups jouables avec ce chevalet pour une IA de ce niveau.
     * Retourne [{ placements: [{ i, l }] }]
     */
    function generateMoves(brain, letters, rack, level) {
        var trie = brain.trie, dict = brain.dict;
        var tLetter = trie.letter, tTerm = trie.term, tMin = trie.minLevel, tChild = trie.child, tNext = trie.next;

        var counts = new Int8Array(26), distinct = [], k;
        for (k = 0; k < rack.length; k++) {
            var code = rack[k].charCodeAt(0) - 65;
            if (code < 0 || code > 25) continue;
            if (!counts[code]) distinct.push(code);
            counts[code]++;
        }

        var empty = Rules.isBoardEmpty(letters);
        var moves = [], singles = {};
        var cells = new Int32Array(SIZE), mask = new Int32Array(SIZE), anchor = new Uint8Array(SIZE);
        var pathCell = new Int32Array(SIZE), pathLetter = new Int32Array(SIZE);
        var start;

        function emit(placed) {
            var placements = [];
            for (var n = 0; n < placed; n++) {
                placements.push({ i: pathCell[n], l: String.fromCharCode(65 + pathLetter[n]) });
            }
            if (placed === 1) {
                var key = placements[0].i + placements[0].l;
                if (singles[key]) return;
                singles[key] = true;
            }
            moves.push({ placements: placements });
        }

        function dfs(pos, node, placed, touched) {
            if (placed && touched && pos - start >= 2 && tTerm[node] && tTerm[node] <= level &&
                (pos === SIZE || !letters[cells[pos]])) {
                emit(placed);
            }
            if (pos === SIZE) return;
            var cell = cells[pos], c;
            if (letters[cell]) {
                var want = letters[cell].charCodeAt(0) - 65;
                for (c = tChild[node]; c; c = tNext[c]) {
                    if (tLetter[c] === want) {
                        if (tMin[c] <= level) dfs(pos + 1, c, placed, true);
                        return;
                    }
                }
                return;
            }
            var allowed = mask[pos];
            if (!allowed) return;
            for (c = tChild[node]; c; c = tNext[c]) {
                var l = tLetter[c];
                if (!counts[l] || tMin[c] > level || !(allowed >> l & 1)) continue;
                counts[l]--;
                pathCell[placed] = cell;
                pathLetter[placed] = l;
                dfs(pos + 1, c, placed + 1, touched || anchor[pos] === 1);
                counts[l]++;
            }
        }

        for (var axis = 0; axis < 2; axis++) {
            var step = axis === 0 ? 1 : SIZE, cross = axis === 0 ? SIZE : 1;
            for (var line = 0; line < SIZE; line++) {
                if (empty && line !== 4) continue;
                var useful = false;
                for (k = 0; k < SIZE; k++) {
                    var cell = axis === 0 ? line * SIZE + k : k * SIZE + line;
                    cells[k] = cell;
                    anchor[k] = 0;
                    mask[k] = ALL_LETTERS;
                    if (letters[cell]) { useful = true; continue; }
                    // Lettres voisines dans la direction perpendiculaire.
                    var before = '', after = '', p = line, q = cell;
                    while (p > 0 && letters[q - cross]) { q -= cross; p--; before = letters[q] + before; }
                    p = line; q = cell;
                    while (p < SIZE - 1 && letters[q + cross]) { q += cross; p++; after += letters[q]; }
                    if (before || after) {
                        var m = 0;
                        for (var d = 0; d < distinct.length; d++) {
                            var lv = dict.level(before + String.fromCharCode(65 + distinct[d]) + after);
                            if (lv && lv <= level) m |= 1 << distinct[d];
                        }
                        mask[k] = m;
                        anchor[k] = 1;
                        useful = true;
                    } else if (empty && cell === CENTER) {
                        anchor[k] = 1;
                        useful = true;
                    }
                }
                if (!useful) continue;
                for (start = 0; start < SIZE - 1; start++) {
                    if (start > 0 && letters[cells[start - 1]]) continue;
                    dfs(start, 0, 0, false);
                }
            }
        }
        return moves;
    }

    // ---------------------------------------------------------------- évaluation

    function gaussian(rng) {
        var u = 1 - rng(), v = rng();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    function leaveValue(rack, placements) {
        var rest = rack.slice(), k;
        for (k = 0; k < placements.length; k++) {
            var at = rest.indexOf(placements[k].l);
            if (at >= 0) rest.splice(at, 1);
        }
        if (!rest.length) return 0;
        var value = 0, seen = {}, vowels = 0;
        for (k = 0; k < rest.length; k++) {
            value += LEAVE[rest[k]] || 0;
            if (seen[rest[k]]) value -= 0.3;
            seen[rest[k]] = true;
            if (Rules.isVowel(rest[k])) vowels++;
        }
        value -= 0.25 * Math.abs(2 * vowels - rest.length);
        return value;
    }

    // Mesure l'effet d'un coup : cases gagnées, cases volées par adversaire, étoile.
    function measure(letters, owners, me, nPlayers, move) {
        var res = Rules.findWords(letters, move.placements);
        var gain = 0, stolen = [], k;
        for (k = 0; k < nPlayers; k++) stolen.push(0);
        if (res.ok) {
            for (k = 0; k < res.cells.length; k++) {
                var o = owners[res.cells[k]];
                if (o !== me) {
                    gain++;
                    if (o >= 0) stolen[o]++;
                }
            }
        }
        move.cells = res.ok ? res.cells : [];
        move.words = res.ok ? res.words.map(function (w) { return w.word; }) : [];
        move.gain = gain;
        move.stolen = stolen;
        move.star = !!res.star;
        return move;
    }

    function randomRack(rng) {
        var state = { racks: [[]], bag: Rules.makeBag(rng) };
        Rules.fillRack(state, 0, rng);
        return state.racks[0];
    }

    // Tort que le joueur suivant peut nous causer après ce coup (moyenne sur quelques chevalets).
    function replyDamage(brain, ctx, move, level, racks) {
        var n = ctx.nPlayers, me = ctx.me, k;
        var letters = ctx.letters.slice(), owners = ctx.owners.slice(), scores = ctx.scores.slice();
        for (k = 0; k < move.placements.length; k++) letters[move.placements[k].i] = move.placements[k].l;
        for (k = 0; k < move.cells.length; k++) owners[move.cells[k]] = me;
        scores[me] += move.gain;
        for (k = 0; k < n; k++) scores[k] -= move.stolen[k];
        if (move.star) {
            for (k = 0; k < CELLS; k++) { letters[k] = ''; owners[k] = -1; }
        }
        var opp = (me + 1) % n;
        var weight = n === 2 ? 1 : 0.5;
        var total = 0;
        for (var r = 0; r < racks.length; r++) {
            var replies = generateMoves(brain, letters, racks[r], level);
            var worst = 0;
            for (k = 0; k < replies.length; k++) {
                var rep = measure(letters, owners, opp, n, replies[k]);
                var damage = rep.stolen[me] + weight * rep.gain;
                if (scores[opp] + rep.gain >= ctx.target) damage += 30;
                if (damage > worst) worst = damage;
            }
            total += worst;
        }
        return total / racks.length;
    }

    function chooseSwap(rack, level) {
        if (level < 5) return rack.slice();
        var keep = {}, kept = 0, swap = [];
        for (var k = 0; k < rack.length; k++) {
            var l = rack[k];
            if (kept < 3 && !keep[l] && (LEAVE[l] || 0) >= 0.2) { keep[l] = true; kept++; }
            else swap.push(l);
        }
        return swap.length ? swap : rack.slice();
    }

    /*
     * ctx : { letters, owners, banked, rack, me, nPlayers, target }
     * Retourne { placements, words, gain } ou { pass: true, swap: [...] }
     */
    function chooseMove(brain, ctx, level, rng) {
        rng = rng || Math.random;
        level = Math.max(1, Math.min(10, level | 0));
        var P = LEVELS[level];
        var n = ctx.nPlayers, me = ctx.me, k, o;

        var board = [], scores = [];
        for (k = 0; k < n; k++) board.push(0);
        for (k = 0; k < CELLS; k++) if (ctx.owners[k] >= 0) board[ctx.owners[k]]++;
        for (k = 0; k < n; k++) scores.push(ctx.banked[k] + board[k]);
        ctx.scores = scores;

        var moves = generateMoves(brain, ctx.letters, ctx.rack, level);
        if (!moves.length) return { pass: true, swap: chooseSwap(ctx.rack, level) };

        var leader = -1;
        for (o = 0; o < n; o++) if (o !== me && (leader < 0 || scores[o] > scores[leader])) leader = o;

        var seen = [];
        for (k = 0; k < moves.length; k++) {
            if (rng() < P.see) seen.push(moves[k]);
        }
        if (!seen.length) seen.push(moves[Math.floor(rng() * moves.length)]);

        for (k = 0; k < seen.length; k++) {
            var m = measure(ctx.letters, ctx.owners, me, n, seen[k]);
            var placed = m.placements.length;
            var value = placed + P.capture * (m.gain - placed);
            for (o = 0; o < n; o++) {
                if (o !== me && m.stolen[o]) value += P.steal * m.stolen[o] * (o === leader ? 1 : 0.5);
            }
            if (m.star) {
                var mine = board[me] + m.gain, best = 0;
                for (o = 0; o < n; o++) {
                    if (o !== me && board[o] - m.stolen[o] > best) best = board[o] - m.stolen[o];
                }
                value += P.star * 0.5 * (mine - best);
            }
            if (P.leave) value += P.leave * leaveValue(ctx.rack, m.placements);
            if (P.noise) value += P.noise * gaussian(rng);
            if (scores[me] + m.gain >= ctx.target) value += 1000;
            m.value = value;
        }
        seen.sort(function (a, b) { return b.value - a.value; });

        if (P.look && seen[0].value < 1000) {
            var racks = [];
            for (k = 0; k < P.look[1]; k++) racks.push(randomRack(rng));
            var top = Math.min(P.look[0], seen.length);
            for (k = 0; k < top; k++) {
                seen[k].value -= 0.6 * replyDamage(brain, ctx, seen[k], level, racks);
            }
            var head = seen.slice(0, top).sort(function (a, b) { return b.value - a.value; });
            seen[0] = head[0];
        }

        var pick = seen[0];
        return { placements: pick.placements, words: pick.words, gain: pick.gain };
    }

    function createBrain(dict) {
        return { dict: dict, trie: buildTrie(dict) };
    }

    var AI = {
        LEVELS: LEVELS,
        createBrain: createBrain,
        generateMoves: generateMoves,
        chooseMove: chooseMove
    };

    root.Wordox = root.Wordox || {};
    root.Wordox.AI = AI;
    if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof self !== 'undefined' ? self : this);
