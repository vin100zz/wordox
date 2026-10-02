#!/usr/bin/env node
/*
 * Parties IA contre IA, pour calibrer les niveaux.
 * Usage : node tools/sim.js [parties par duel] [--words]
 */
var fs = require('fs');
var path = require('path');
var Rules = require('../js/rules.js');
var Dict = require('../js/dict.js');
var AI = require('../js/ai.js');

var dict = Dict.parse(fs.readFileSync(path.join(__dirname, '..', 'dict', 'words.txt'), 'utf8'));
var brain = AI.createBrain(dict);
var isWord = function (w) { return dict.has(w); };
var GAMES = parseInt(process.argv[2], 10) || 40;

function play(levels, log) {
    var players = levels.map(function (l, i) { return { name: 'IA' + i, kind: 'ai', level: l }; });
    var state = Rules.createGame(players, 25);
    var turns = 0, time = 0, maxTime = 0;
    while (!state.over && turns++ < 400) {
        var me = state.current;
        var t0 = Date.now();
        var choice = AI.chooseMove(brain, {
            letters: state.letters, owners: state.owners, banked: state.banked,
            rack: state.racks[me], me: me, nPlayers: players.length, target: state.target
        }, levels[me]);
        var dt = Date.now() - t0;
        time += dt;
        if (dt > maxTime) maxTime = dt;
        var res = choice.pass ? Rules.applyPass(state, choice.swap) : Rules.applyMove(state, choice.placements, isWord);
        if (!res.ok) throw new Error(res.error);
        if (log && !choice.pass) log(levels[me], state.last);
    }
    return { winners: state.winners, turns: turns, avgTime: time / turns, maxTime: maxTime };
}

function duel(a, b) {
    var wins = 0, turns = 0, avg = 0, max = 0;
    for (var g = 0; g < GAMES; g++) {
        var res = play([a, b]);
        if (res.winners.length === 1 && res.winners[0] === 0) wins++;
        else if (res.winners.length > 1) wins += 0.5;
        turns += res.turns;
        avg += res.avgTime;
        if (res.maxTime > max) max = res.maxTime;
    }
    return { rate: wins / GAMES, turns: turns / GAMES, avg: avg / GAMES, max: max };
}

if (process.argv.indexOf('--words') >= 0) {
    for (var level = 1; level <= 10; level++) {
        var words = [];
        for (var g = 0; g < 3; g++) {
            play([level, level], function (lv, last) { words.push(last.words[0]); });
        }
        console.log('Niveau ' + level + ' : ' + words.slice(0, 40).join(' '));
    }
} else {
    console.log('Taux de victoire du premier niveau cité (' + GAMES + ' parties par duel)');
    var duels = [];
    for (var hi = 2; hi <= 10; hi++) duels.push([hi, hi - 1]);
    duels.push([5, 1], [10, 5], [10, 1]);
    duels.forEach(function (d) {
        var r = duel(d[0], d[1]);
        console.log('  ' + d[0] + ' contre ' + d[1] + ' : ' + Math.round(r.rate * 100) + ' %' +
            '   (' + r.turns.toFixed(0) + ' tours, ' + r.avg.toFixed(0) + ' ms/coup, max ' + r.max + ' ms)');
    });
}
