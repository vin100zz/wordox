#!/usr/bin/env node
/*
 * Construit dict/words.txt à partir de :
 *   tools/data/ods4.txt        liste de référence (ODS4, mots de 2 à 9 lettres)
 *   tools/data/Lexique383.tsv  fréquences d'usage (http://www.lexique.org, non versionné)
 *
 * Chaque mot reçoit un niveau de 1 à 10 : le plus petit niveau d'IA qui "connaît" ce mot.
 * Le niveau 10 connaît toute la liste. Les humains peuvent jouer tous les mots.
 *
 * Usage : node tools/build-dict.js [--report]
 */
var fs = require('fs');
var path = require('path');

var DATA = path.join(__dirname, 'data');
var OUT = path.join(__dirname, '..', 'dict', 'words.txt');

// Nombre cumulé de mots connus à chaque niveau (classés du plus au moins courant).
// Le niveau 10 prend tout le reste.
var CUMULATIVE = [2000, 4000, 7000, 11000, 17000, 25000, 36000, 52000, 80000];

// Un joueur de Scrabble connaît les petits mots : niveau maximal selon la longueur.
var SHORT_WORD_CAP = { 2: 4, 3: 6, 4: 8 };

// Poids de la fréquence du lemme (MANGEAMES profite un peu de MANGER).
var LEMMA_WEIGHT = 0.03;

function normalize(s) {
    return s.replace(/œ/g, 'oe').replace(/æ/g, 'ae')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase();
}

function readFrequencies() {
    var file = path.join(DATA, 'Lexique383.tsv');
    if (!fs.existsSync(file)) {
        console.error('Fichier manquant : ' + file);
        console.error('Téléchargez http://www.lexique.org/databases/Lexique383/Lexique383.tsv');
        process.exit(1);
    }
    var lines = fs.readFileSync(file, 'utf8').split('\n');
    var head = lines[0].split('\t');
    var col = {};
    head.forEach(function (h, i) { col[h.trim()] = i; });
    var form = {}, lemma = {};
    for (var i = 1; i < lines.length; i++) {
        var f = lines[i].split('\t');
        if (f.length < 10) continue;
        var w = normalize(f[col.ortho]);
        if (!/^[A-Z]{2,9}$/.test(w)) continue;
        var ff = (parseFloat(f[col.freqfilms2]) + parseFloat(f[col.freqlivres])) / 2 || 0;
        var fl = (parseFloat(f[col.freqlemfilms2]) + parseFloat(f[col.freqlemlivres])) / 2 || 0;
        form[w] = (form[w] || 0) + ff;
        if (!(lemma[w] >= fl)) lemma[w] = fl;
    }
    return { form: form, lemma: lemma };
}

function build() {
    var words = fs.readFileSync(path.join(DATA, 'ods4.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
    var freq = readFrequencies();

    var scored = words.map(function (w) {
        var known = freq.form[w] !== undefined;
        var score = known ? freq.form[w] + LEMMA_WEIGHT * freq.lemma[w] : -1;
        return { w: w, score: score };
    });
    // Tri stable : fréquence décroissante, puis mots courts d'abord, puis alphabétique.
    scored.sort(function (a, b) {
        return b.score - a.score || a.w.length - b.w.length || (a.w < b.w ? -1 : 1);
    });

    var levels = [];
    for (var l = 0; l <= 10; l++) levels.push([]);
    var inLexique = 0;
    scored.forEach(function (e, rank) {
        var level = 10;
        if (e.score >= 0) {
            inLexique++;
            for (var k = 0; k < CUMULATIVE.length; k++) {
                if (rank < CUMULATIVE[k]) { level = k + 1; break; }
            }
        }
        var cap = SHORT_WORD_CAP[e.w.length];
        if (cap && level > cap) level = cap;
        e.level = level;
        levels[level].push(e.w);
    });

    var out = [];
    for (l = 1; l <= 10; l++) {
        levels[l].sort();
        out.push('=' + l);
        out.push.apply(out, levels[l]);
    }
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, out.join('\n') + '\n');

    console.log('Mots : ' + words.length + ' (dont ' + inLexique + ' présents dans Lexique)');
    var cum = 0;
    for (l = 1; l <= 10; l++) {
        cum += levels[l].length;
        console.log('  niveau ' + (l < 10 ? ' ' : '') + l + ' : +' + levels[l].length + ' -> ' + cum);
    }
    console.log('Écrit : ' + OUT);

    if (process.argv.indexOf('--report') >= 0) {
        for (l = 1; l <= 10; l++) {
            var pool = levels[l].filter(function (w) { return w.length >= 4 && w.length <= 7; });
            var pick = [];
            for (var n = 0; n < 24 && pool.length; n++) {
                pick.push(pool[Math.floor((n + 0.5) * pool.length / 24)]);
            }
            console.log('\nNiveau ' + l + ' : ' + pick.join(' '));
        }
    }
}

build();
