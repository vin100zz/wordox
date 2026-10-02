#!/usr/bin/env node
/*
 * Tests du moteur de règles et du générateur de coups.
 * Usage : node tools/test-rules.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var Rules = require('../js/rules.js');
var Dict = require('../js/dict.js');
var AI = require('../js/ai.js');

var dict = Dict.parse(fs.readFileSync(path.join(__dirname, '..', 'dict', 'words.txt'), 'utf8'));
var isWord = function (w) { return dict.has(w); };
var passed = 0;

function test(name, fn) {
    fn();
    passed++;
    console.log('ok - ' + name);
}

function seeded(seed) {
    return function () {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

function at(r, c) { return r * Rules.SIZE + c; }

// Pose un mot horizontalement (h) ou verticalement à partir de (r, c) ; ignore les cases déjà remplies.
function word(state, w, r, c, vertical) {
    var pl = [];
    for (var k = 0; k < w.length; k++) {
        var i = vertical ? at(r + k, c) : at(r, c + k);
        if (!state.letters[i]) pl.push({ i: i, l: w[k] });
    }
    return pl;
}

function game(n, racks) {
    var players = [];
    for (var p = 0; p < n; p++) players.push({ name: 'J' + p, kind: 'human' });
    var state = Rules.createGame(players, 25, seeded(42));
    state.current = 0;
    if (racks) state.racks = racks.map(function (r) { return r.split(''); });
    return state;
}

test('dictionnaire chargé', function () {
    assert.strictEqual(dict.size, 156878);
    assert.ok(dict.has('KA') && dict.has('EWE') && dict.has('XI') && dict.has('AA'));
    assert.ok(!dict.has('BLOG') && !dict.has('QI'));
    assert.strictEqual(dict.level('ZZZ'), 0);
});

test('distribution et chevalets', function () {
    var state = game(4);
    assert.strictEqual(state.racks.length, 4);
    state.racks.forEach(function (r) {
        assert.strictEqual(r.length, 6);
        var v = r.filter(Rules.isVowel).length;
        assert.ok(v >= 2 && v <= 4, 'chevalet équilibré : ' + r.join(''));
    });
});

test('premier coup : case centrale et 2 lettres minimum', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    assert.strictEqual(Rules.applyMove(state, word(state, 'CHAT', 0, 0), isWord).code, 'center');
    assert.strictEqual(Rules.applyMove(state, [{ i: Rules.CENTER, l: 'A' }], isWord).code, 'short');
    assert.strictEqual(Rules.applyMove(state, word(state, 'CHAT', 4, 2), isWord).ok, true);
    assert.strictEqual(Rules.score(state, 0), 4);
    assert.strictEqual(state.current, 1);
    assert.strictEqual(state.racks[0].length, 6);
});

test('erreurs de placement', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    Rules.applyMove(state, word(state, 'CHAT', 4, 2), isWord);
    var res = Rules.applyMove(state, [{ i: at(0, 0), l: 'R' }, { i: at(1, 1), l: 'I' }], isWord);
    assert.strictEqual(res.code, 'line');
    res = Rules.applyMove(state, [{ i: at(5, 2), l: 'R' }, { i: at(5, 4), l: 'I' }], isWord);
    assert.strictEqual(res.code, 'gap');
    res = Rules.applyMove(state, word(state, 'RIEN', 0, 0), isWord);
    assert.strictEqual(res.code, 'touch');
    res = Rules.applyMove(state, [{ i: at(4, 2), l: 'R' }], isWord);
    assert.strictEqual(res.code, 'occupied');
    res = Rules.applyMove(state, [{ i: at(4, 6), l: 'Z' }], isWord);
    assert.strictEqual(res.code, 'rack');
    res = Rules.applyMove(state, [{ i: at(4, 6), l: 'R' }], isWord);
    assert.strictEqual(res.code, 'invalid');
    assert.strictEqual(state.current, 1, 'un coup refusé ne change pas le tour');
});

test('capture : toutes les lettres des mots formés changent de couleur', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    Rules.applyMove(state, word(state, 'CHAT', 4, 2), isWord);
    // CHATS : le joueur 1 ajoute un S et prend tout le mot.
    var res = Rules.applyMove(state, [{ i: at(4, 6), l: 'S' }], isWord);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(Rules.score(state, 0), 0);
    assert.strictEqual(Rules.score(state, 1), 5);
    assert.deepStrictEqual(state.last.stolen, [4, 0]);
    assert.strictEqual(state.last.gained, 5);
});

test('capture partielle par un mot croisé', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    Rules.applyMove(state, word(state, 'CHAT', 4, 2), isWord);
    // RIAS vertical passant par le A de CHAT : seul le A est volé.
    var res = Rules.applyMove(state, word(state, 'RIAS', 2, 4, true), isWord);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(Rules.score(state, 0), 3);
    assert.strictEqual(Rules.score(state, 1), 4);
});

test('coin étoilé : plateau vidé et scores figés', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    state.letters[at(0, 1)] = 'A'; state.owners[at(0, 1)] = 0;
    state.letters[at(0, 2)] = 'S'; state.owners[at(0, 2)] = 0;
    state.letters[at(5, 5)] = 'E'; state.owners[at(5, 5)] = 1;
    var res = Rules.applyMove(state, [{ i: at(0, 0), l: 'T' }], isWord); // TAS
    assert.strictEqual(res.ok, true);
    assert.strictEqual(state.last.star, true);
    assert.ok(Rules.isBoardEmpty(state.letters));
    assert.deepStrictEqual(state.banked, [3, 1]);
    assert.strictEqual(Rules.score(state, 0), 3);
    // Le coup suivant doit repasser par le centre.
    assert.strictEqual(Rules.applyMove(state, word(state, 'RIEN', 0, 0), isWord).code, 'center');
});

test('victoire quand l\'objectif est atteint', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    state.banked[0] = 22;
    Rules.applyMove(state, word(state, 'CHAT', 4, 2), isWord);
    assert.strictEqual(state.over, true);
    assert.deepStrictEqual(state.winners, [0]);
    assert.strictEqual(Rules.applyMove(state, [{ i: at(4, 6), l: 'S' }], isWord).code, 'over');
});

test('passer, échanger, fin de partie par abandon général', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    state.banked = [3, 7];
    assert.strictEqual(Rules.applyPass(state, ['Z']).code, 'rack');
    assert.strictEqual(Rules.applyPass(state, ['C', 'H']).ok, true);
    assert.strictEqual(state.racks[0].length, 6);
    assert.strictEqual(state.current, 1);
    Rules.applyPass(state); Rules.applyPass(state);
    assert.strictEqual(state.over, false);
    Rules.applyPass(state);
    assert.strictEqual(state.over, true);
    assert.deepStrictEqual(state.winners, [1]);
});

test('vue d\'un joueur distant : chevalets adverses masqués', function () {
    var state = game(2, ['CHATSE', 'RIENAS']);
    var view = Rules.viewFor(state, 1);
    assert.deepStrictEqual(view.racks[0], ['?', '?', '?', '?', '?', '?']);
    assert.deepStrictEqual(view.racks[1], state.racks[1]);
    assert.strictEqual(view.bag.length, 0);
});

// ------------------------------------------------------------------ générateur de coups

var brain = AI.createBrain(dict);

function key(placements) {
    return placements.map(function (p) { return p.i + p.l; }).sort().join(' ');
}

// Générateur naïf : essaie chaque mot du dictionnaire à chaque emplacement.
function bruteForce(letters, rack, level) {
    var byLen = {};
    dict.levels.forEach(function (lv, w) {
        if (lv <= level) (byLen[w.length] = byLen[w.length] || []).push(w);
    });
    var known = function (w) { var lv = dict.level(w); return lv > 0 && lv <= level; };
    var found = {};
    for (var axis = 0; axis < 2; axis++) {
        for (var line = 0; line < 9; line++) {
            for (var s = 0; s < 9; s++) {
                for (var len = 2; s + len <= 9; len++) {
                    var cells = [];
                    for (var k = 0; k < len; k++) cells.push(axis ? at(s + k, line) : at(line, s + k));
                    var list = byLen[len] || [];
                    for (var w = 0; w < list.length; w++) {
                        var pl = [], rest = rack.slice(), fits = true;
                        for (k = 0; k < len && fits; k++) {
                            var have = letters[cells[k]];
                            if (have) { if (have !== list[w][k]) fits = false; }
                            else {
                                var idx = rest.indexOf(list[w][k]);
                                if (idx < 0) fits = false;
                                else { rest.splice(idx, 1); pl.push({ i: cells[k], l: list[w][k] }); }
                            }
                        }
                        if (!fits || !pl.length) continue;
                        if (Rules.checkMove(letters, pl, known).ok) found[key(pl)] = true;
                    }
                }
            }
        }
    }
    return Object.keys(found).sort();
}

test('générateur : identique à la recherche exhaustive', function () {
    var rng = seeded(7);
    var state = game(2);
    var checked = 0;
    for (var turn = 0; turn < 14 && !state.over; turn++) {
        var level = [3, 6, 10][turn % 3];
        var rack = state.racks[state.current];
        var moves = AI.generateMoves(brain, state.letters, rack, level);
        var mine = moves.map(function (m) { return key(m.placements); }).sort();
        if (turn % 3 === 0 || turn > 10) {
            assert.deepStrictEqual(mine, bruteForce(state.letters, rack, level), 'tour ' + turn);
            checked++;
        }
        moves.forEach(function (m) {
            assert.ok(Rules.checkMove(state.letters, m.placements, isWord).ok);
        });
        // Pour avancer, on joue un coup qui évite les coins (pour garder un plateau chargé).
        var keep = moves.filter(function (m) {
            return !m.placements.some(function (p) { return Rules.isStar(p.i); });
        });
        if (!keep.length) { Rules.applyPass(state, rack.slice(), rng); continue; }
        var pick = keep[Math.floor(rng() * keep.length)];
        assert.strictEqual(Rules.applyMove(state, pick.placements, isWord, rng).ok, true);
    }
    assert.ok(checked >= 5);
});

test('IA : joue toujours un coup valide, à tous les niveaux', function () {
    var rng = seeded(99);
    for (var level = 1; level <= 10; level++) {
        var players = [{ name: 'A', kind: 'ai', level: level }, { name: 'B', kind: 'ai', level: level }];
        var state = Rules.createGame(players, 25, rng);
        var turns = 0;
        while (!state.over && turns++ < 300) {
            var me = state.current;
            var choice = AI.chooseMove(brain, {
                letters: state.letters, owners: state.owners, banked: state.banked,
                rack: state.racks[me], me: me, nPlayers: 2, target: state.target
            }, level, rng);
            var res = choice.pass ? Rules.applyPass(state, choice.swap, rng)
                : Rules.applyMove(state, choice.placements, isWord, rng);
            assert.strictEqual(res.ok, true, res.error);
            if (!choice.pass) {
                state.last.words.forEach(function (w) {
                    assert.ok(dict.level(w) <= level, w + ' hors vocabulaire du niveau ' + level);
                });
            }
        }
        assert.ok(state.over, 'partie terminée au niveau ' + level);
    }
});

console.log('\n' + passed + ' tests réussis');
