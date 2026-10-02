/*
 * Wordox - worker de l'IA : la recherche de coups ne bloque pas l'interface.
 * Messages reçus : { type: 'init', text }  puis  { type: 'think', id, ctx, level }
 */
var version = self.location.search || '';
importScripts('rules.js' + version, 'dict.js' + version, 'ai.js' + version);

var brain = null;

self.onmessage = function (e) {
    var msg = e.data;
    if (msg.type === 'init') {
        brain = Wordox.AI.createBrain(Wordox.Dict.parse(msg.text));
        self.postMessage({ type: 'ready' });
    } else if (msg.type === 'think') {
        var choice = Wordox.AI.chooseMove(brain, msg.ctx, msg.level);
        self.postMessage({ type: 'choice', id: msg.id, choice: choice });
    }
};
