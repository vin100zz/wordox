/*
 * Wordox - dictionnaire.
 * Format de dict/words.txt : des sections "=N" (N de 1 à 10) suivies d'un mot par ligne.
 * N est le plus petit niveau d'IA qui connaît le mot ; tous les mots sont valides pour un humain.
 */
(function (root) {
    'use strict';

    var MAX_LEVEL = 10;

    function parse(text) {
        var levels = new Map();
        var level = MAX_LEVEL;
        var start = 0, len = text.length;
        while (start < len) {
            var end = text.indexOf('\n', start);
            if (end < 0) end = len;
            var line = text.substring(start, end);
            if (line.charCodeAt(line.length - 1) === 13) line = line.substring(0, line.length - 1);
            start = end + 1;
            if (!line) continue;
            if (line.charCodeAt(0) === 61) level = parseInt(line.substring(1), 10) || MAX_LEVEL;
            else levels.set(line, level);
        }
        return {
            levels: levels,
            size: levels.size,
            has: function (word) { return levels.has(word); },
            // Niveau du mot, ou 0 s'il n'existe pas.
            level: function (word) { return levels.get(word) || 0; }
        };
    }

    var Dict = { MAX_LEVEL: MAX_LEVEL, parse: parse };

    root.Wordox = root.Wordox || {};
    root.Wordox.Dict = Dict;
    if (typeof module !== 'undefined' && module.exports) module.exports = Dict;
})(typeof self !== 'undefined' ? self : this);
