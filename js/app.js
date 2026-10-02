/*
 * Wordox - interface : écrans, affichage du plateau, déroulement d'une partie
 * (solo contre des IA, ou à deux en pair-à-pair).
 */
(function () {
    'use strict';

    var Rules = Wordox.Rules;
    var CONFIG = window.WORDOX_CONFIG;
    var SIZE = Rules.SIZE, CELLS = Rules.CELLS;
    var COLOR_NAMES = ['Bleu', 'Rouge', 'Jaune', 'Vert'];
    var LEVEL_NAMES = ['', 'Débutant', 'Débutant', 'Novice', 'Novice', 'Amateur', 'Amateur', 'Confirmé', 'Confirmé', 'Expert', 'Champion'];
    var SAVE_KEY = 'wordox.save', SETUP_KEY = 'wordox.setup', NAME_KEY = 'wordox.name';
    var PLAYING_KEY = 'wordox.playing';
    var MIN_TARGET = 10, MAX_TARGET = 100;
    var AI_DELAY = 1000; // temps de "réflexion" minimal d'une IA, en ms
    var LOCK_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

    var dict = null;          // dictionnaire, pour valider les mots
    var worker = null;        // worker de l'IA
    var thinking = {}, thinkSeq = 0;
    var session = null;       // partie en cours
    var cells = [];           // éléments des 81 cases
    var cellSize = 36;
    var tileSeq = 0;

    var setup = { count: 1, levels: [5, 5, 5], target: Rules.DEFAULT_TARGET };
    var online = { peer: null, role: '', name: '', remoteName: '', target: Rules.DEFAULT_TARGET, game: 0 };

    function $(id) { return document.getElementById(id); }

    function esc(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c];
        });
    }

    function isWord(word) { return dict.has(word); }

    // ------------------------------------------------------------------ stockage local

    function load(key) {
        try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    }
    function store(key, value) {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(value));
        } catch (e) { /* stockage indisponible : la partie ne sera pas sauvegardée */ }
    }

    // Retient, pour cet onglet seulement, qu'une partie solo est à l'écran :
    // si la page est rechargée, on y revient directement au lieu de repasser par le menu.
    function markPlaying(on) {
        try {
            if (on) sessionStorage.setItem(PLAYING_KEY, '1');
            else sessionStorage.removeItem(PLAYING_KEY);
        } catch (e) { /* stockage indisponible : retour au menu après un rechargement */ }
    }
    function wasPlaying() {
        try { return sessionStorage.getItem(PLAYING_KEY) === '1'; } catch (e) { return false; }
    }

    // ------------------------------------------------------------------ dictionnaire et IA

    function loadDictionary() {
        return fetch(CONFIG.dictUrl).then(function (res) {
            if (!res.ok) throw new Error('dictionnaire');
            return res.text();
        }).then(function (text) {
            dict = Wordox.Dict.parse(text);
            worker = new Worker(CONFIG.workerUrl);
            worker.onmessage = function (e) {
                if (e.data.type !== 'choice') return;
                var cb = thinking[e.data.id];
                delete thinking[e.data.id];
                if (cb) cb(e.data.choice);
            };
            worker.postMessage({ type: 'init', text: text });
        });
    }

    function think(ctx, level, cb) {
        var id = ++thinkSeq;
        thinking[id] = cb;
        worker.postMessage({ type: 'think', id: id, ctx: ctx, level: level });
    }

    // ------------------------------------------------------------------ écrans et fenêtres

    function show(name) {
        ['home', 'solo', 'online', 'game'].forEach(function (n) {
            $('screen-' + n).hidden = n !== name;
        });
        if (name === 'home') $('home-resume').hidden = !dict || !load(SAVE_KEY);
        if (name === 'game') layout();
    }

    function openModal(id) { $(id).hidden = false; }
    function closeModals() {
        var all = document.querySelectorAll('.modal');
        for (var k = 0; k < all.length; k++) all[k].hidden = true;
    }

    function bindStepper(el, get, set) {
        var out = el.querySelector('output');
        out.textContent = get();
        el.addEventListener('click', function (e) {
            var step = parseInt(e.target.getAttribute('data-step'), 10);
            if (!step) return;
            set(Math.max(MIN_TARGET, Math.min(MAX_TARGET, get() + step)));
            out.textContent = get();
        });
    }

    // ------------------------------------------------------------------ réglages solo

    function renderSoloSetup() {
        var buttons = $('solo-count').querySelectorAll('button');
        for (var k = 0; k < buttons.length; k++) {
            var on = +buttons[k].getAttribute('data-n') === setup.count;
            buttons[k].classList.toggle('on', on);
            buttons[k].setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        var html = '';
        for (k = 0; k < setup.count; k++) {
            html += '<div class="level-row p' + (k + 1) + '">' +
                '<span class="tile p' + (k + 1) + '" aria-hidden="true">' + COLOR_NAMES[k + 1][0] + '</span>' +
                '<span class="level-name">' + COLOR_NAMES[k + 1] + '</span>' +
                '<output>' + levelLabel(setup.levels[k]) + '</output>' +
                '<input type="range" min="1" max="10" step="1" value="' + setup.levels[k] + '" data-ai="' + k + '" aria-label="Niveau de ' + COLOR_NAMES[k + 1] + '" style="--fill:' + levelFill(setup.levels[k]) + '"></div>';
        }
        $('solo-levels').innerHTML = html;
    }

    function levelLabel(level) { return level + ' · ' + LEVEL_NAMES[level]; }

    // Part de la piste du curseur à colorer pour ce niveau.
    function levelFill(level) { return Math.round((level - 1) / 9 * 100) + '%'; }

    function startSolo() {
        store(SETUP_KEY, setup);
        var players = [{ name: 'Vous', kind: 'human' }];
        for (var k = 0; k < setup.count; k++) {
            players.push({ name: COLOR_NAMES[k + 1], kind: 'ai', level: setup.levels[k] });
        }
        begin('solo', 0, Rules.createGame(players, setup.target), null);
    }

    // ------------------------------------------------------------------ partie : état local

    function viewOf(state) {
        return {
            letters: state.letters.slice(), owners: state.owners.slice(),
            banked: state.banked.slice(), current: state.over ? -1 : state.current
        };
    }

    function begin(mode, seat, state, peer) {
        Wordox.Drag.cancel();
        session = {
            mode: mode, seat: seat, state: state, peer: peer,
            hand: [],          // mes lettres : { id, l, cell } (cell = -1 sur le chevalet)
            selected: null,    // lettre choisie par un appui (pour la poser d'un second appui)
            view: viewOf(state),
            preview: null, lastCells: {}, popCells: {},
            animating: false, waiting: false, queue: []
        };
        if (mode === 'solo') store(SAVE_KEY, state);
        markPlaying(mode === 'solo');
        syncHand();
        closeModals();
        document.documentElement.style.setProperty('--mine', 'var(--p' + seat + ')');
        document.documentElement.style.setProperty('--mine-strong', 'var(--p' + seat + '-strong)');
        $('goal').textContent = state.target;
        show('game');
        nextTurn();
    }

    // Aligne mes lettres sur le chevalet connu des règles, en gardant l'ordre choisi par le joueur.
    function syncHand() {
        var rack = session.state.racks[session.seat].slice();
        var hand = [];
        function keep(onBoard) {
            session.hand.forEach(function (t) {
                if ((t.cell >= 0) !== onBoard) return;
                var at = rack.indexOf(t.l);
                if (at < 0) return;
                rack.splice(at, 1);
                t.cell = -1;
                hand.push(t);
            });
        }
        keep(false);
        keep(true);
        rack.forEach(function (l) { hand.push({ id: ++tileSeq, l: l, cell: -1 }); });
        session.hand = hand;
        session.selected = null;
    }

    function tileById(id) {
        for (var k = 0; k < session.hand.length; k++) {
            if (session.hand[k].id === +id) return session.hand[k];
        }
        return null;
    }

    function pending() {
        var out = [];
        session.hand.forEach(function (t) { if (t.cell >= 0) out.push({ i: t.cell, l: t.l }); });
        return out;
    }

    function myTurn() {
        return !!session && !session.animating && !session.waiting && !session.state.over &&
            session.state.current === session.seat;
    }

    function nameOf(p) {
        if (p === session.seat && session.mode === 'solo') return 'Vous';
        return session.state.players[p].name;
    }

    // ------------------------------------------------------------------ affichage

    function buildBoard() {
        var board = $('board');
        for (var i = 0; i < CELLS; i++) {
            var cell = document.createElement('div');
            cell.className = 'cell' + (Rules.isStar(i) ? ' star' : '') + (i === Rules.CENTER ? ' center' : '');
            cell.setAttribute('data-i', i);
            board.appendChild(cell);
            cells.push(cell);
        }
    }

    function layout() {
        if ($('screen-game').hidden) return;
        var wrap = $('board-wrap');
        var side = Math.min(wrap.clientWidth, wrap.clientHeight);
        // L'espace entre les cases suit la taille du plateau ; la marge du plateau vaut deux espaces.
        var gap = Math.max(3, Math.round(side / 100));
        cellSize = Math.max(14, Math.floor((side - gap * (SIZE + 3)) / SIZE));
        var rackWidth = $('rack-wrap').clientWidth;
        // La taille des lettres du chevalet ne dépend pas de celle du plateau, pour éviter tout va-et-vient.
        var tile = Math.floor(Math.min((rackWidth - 20 - 5 * 8) / Rules.RACK_SIZE, 84, window.innerHeight * 0.115));
        var style = document.documentElement.style;
        style.setProperty('--gap', gap + 'px');
        style.setProperty('--cell', cellSize + 'px');
        style.setProperty('--tile', Math.max(26, tile) + 'px');
    }

    function renderScores() {
        var s = session, view = s.view, target = s.state.target, html = '';
        s.state.players.forEach(function (pl, p) {
            var onBoard = 0;
            for (var i = 0; i < CELLS; i++) if (view.owners[i] === p) onBoard++;
            var banked = view.banked[p];
            var label = nameOf(p), badge = '';
            if (pl.kind === 'ai') badge = '<em class="score-chip" title="Niveau ' + pl.level + '"><span>niv </span>' + pl.level + '</em>';
            else if (s.mode !== 'solo' && p === s.seat) label += ' (vous)';
            var w1 = Math.min(100, banked / target * 100);
            var w2 = Math.min(100 - w1, onBoard / target * 100);
            html += '<div class="score p' + p + (view.current === p ? ' active' : '') + '"><div class="score-in">' +
                '<div class="score-name"><span>' + esc(label) + '</span></div>' + badge +
                '<div class="score-total">' + (banked + onBoard) + '</div>' +
                '<div class="score-meter">' +
                '<div class="score-bar"><i style="width:' + w1 + '%"></i><i class="placed" style="width:' + w2 + '%"></i></div>' +
                (banked ? '<span class="score-banked" title="Points figés">' + LOCK_ICON + banked + '</span>' : '') +
                '</div></div></div>';
        });
        $('scores').className = 'scores n' + s.state.players.length;
        $('scores').innerHTML = html;
    }

    function renderBoard() {
        var s = session, view = s.view;
        var pendingAt = {}, capture = {};
        s.hand.forEach(function (t) { if (t.cell >= 0) pendingAt[t.cell] = t; });
        if (s.preview && s.preview.ok) s.preview.cells.forEach(function (i) { capture[i] = true; });
        for (var i = 0; i < CELLS; i++) {
            var cell = cells[i], tile = cell.firstChild, t = pendingAt[i], letter = view.letters[i];
            if (!letter && !t) {
                if (tile) cell.removeChild(tile);
                continue;
            }
            if (!tile) {
                tile = document.createElement('div');
                cell.appendChild(tile);
            }
            var cls = 'tile';
            if (t) {
                cls += ' p' + s.seat + ' pending draggable';
                tile.setAttribute('data-tile', t.id);
                letter = t.l;
            } else {
                cls += ' p' + view.owners[i];
                tile.removeAttribute('data-tile');
                if (capture[i] && view.owners[i] !== s.seat) cls += ' capture';
                else if (s.lastCells[i]) cls += ' last';
                if (s.popCells[i]) cls += ' pop';
            }
            if (tile.className !== cls) tile.className = cls;
            if (tile.textContent !== letter) tile.textContent = letter;
        }
    }

    function renderRack() {
        var s = session, rack = $('rack'), free = Rules.RACK_SIZE;
        rack.innerHTML = '';
        s.hand.forEach(function (t) {
            if (t.cell >= 0) return;
            var el = document.createElement('div');
            el.className = 'tile p' + s.seat + ' draggable' + (s.selected === t.id ? ' selected' : '');
            el.setAttribute('data-tile', t.id);
            el.textContent = t.l;
            rack.appendChild(el);
            free--;
        });
        // Les lettres posées sur le plateau laissent leur emplacement en creux.
        for (; free > 0; free--) {
            var slot = document.createElement('div');
            slot.className = 'slot';
            rack.appendChild(slot);
        }
        rack.classList.toggle('locked', !myTurn());
    }

    function renderButtons() {
        var mine = myTurn(), placed = pending().length > 0;
        $('btn-play').disabled = !mine || !placed;
        $('btn-recall').disabled = !placed;
        $('btn-pass').disabled = !mine;
    }

    // gain : pour l'aperçu d'un coup, nombre de points affiché en pastille après les mots.
    function setStatus(text, error, gain) {
        var el = $('status');
        el.textContent = text;
        el.classList.toggle('preview', gain !== undefined);
        if (gain !== undefined) {
            var badge = document.createElement('span');
            badge.className = 'status-gain';
            badge.textContent = '+' + gain;
            el.appendChild(badge);
        }
        el.classList.toggle('error', !!error);
        el.classList.remove('shake');
        if (error) {
            void el.offsetWidth; // relance l'animation
            el.classList.add('shake');
        }
    }

    function turnStatus() {
        var s = session, st = s.state;
        if (st.over) return 'Partie terminée';
        if (s.waiting) return 'Envoi du coup…';
        if (st.current === s.seat) {
            if (st.last && st.last.player !== s.seat) return moveText(st.last) + ' — à vous';
            return Rules.isBoardEmpty(st.letters) ? 'À vous : passez par la case centrale' : 'À vous de jouer';
        }
        var pl = st.players[st.current];
        if (pl.kind === 'ai') return pl.name + ' réfléchit…';
        return 'Au tour ' + (/^[aeiouyh]/i.test(pl.name) ? 'd’' : 'de ') + pl.name;
    }

    // Recalcule l'aperçu du coup en préparation, puis redessine plateau, chevalet et boutons.
    function refresh() {
        var s = session, placed = pending();
        if (!placed.length) {
            s.preview = null;
            setStatus(turnStatus());
        } else {
            var res = Rules.findWords(s.view.letters, placed);
            s.preview = res;
            if (res.ok) {
                var gain = 0;
                res.cells.forEach(function (i) { if (s.view.owners[i] !== s.seat) gain++; });
                setStatus(res.words.map(function (w) { return w.word; }).join(' + '), false, gain);
            } else {
                setStatus(res.error);
            }
        }
        renderBoard();
        renderRack();
        renderButtons();
    }

    function renderAll(keepStatus) {
        renderScores();
        if (keepStatus) { renderBoard(); renderRack(); renderButtons(); }
        else refresh();
    }

    // ------------------------------------------------------------------ manipulation des lettres

    function placeTile(t, i) {
        if (!myTurn() || session.view.letters[i]) return;
        session.hand.forEach(function (o) {
            if (o !== t && o.cell === i) o.cell = t.cell; // échange avec la lettre déjà posée là
        });
        t.cell = i;
    }

    // Remet la lettre sur le chevalet, à la position correspondant à l'abscisse x.
    function returnToRack(t, x) {
        var els = $('rack').querySelectorAll('.tile'), index = 0;
        for (var k = 0; k < els.length; k++) {
            if (+els[k].getAttribute('data-tile') === t.id) continue;
            var r = els[k].getBoundingClientRect();
            if (r.left + r.width / 2 < x) index++;
        }
        var hand = session.hand;
        hand.splice(hand.indexOf(t), 1);
        t.cell = -1;
        var at = hand.length, seen = 0;
        for (k = 0; k < hand.length; k++) {
            if (hand[k].cell >= 0) continue;
            if (seen === index) { at = k; break; }
            seen++;
        }
        hand.splice(at, 0, t);
    }

    function recallAll() {
        session.hand.forEach(function (t) { t.cell = -1; });
        session.selected = null;
    }

    function clearDropMarks() {
        var marked = document.querySelectorAll('.drop');
        for (var k = 0; k < marked.length; k++) marked[k].classList.remove('drop');
    }

    function bindDrag() {
        Wordox.Drag.attach($('screen-game'), {
            canDrag: function (el) {
                return !!session && !session.animating && el.hasAttribute('data-tile');
            },
            size: function () { return cellSize; },
            targetAt: function (x, y, px, py) {
                var rack = $('rack').getBoundingClientRect();
                var inRackX = px >= rack.left - 12 && px <= rack.right + 12;
                if (inRackX && py >= rack.top + rack.height * 0.3 && py <= rack.bottom + 40) {
                    return { type: 'rack', x: px };
                }
                var el = document.elementFromPoint(x, y);
                var cell = el && el.closest ? el.closest('.cell') : null;
                if (cell && myTurn()) {
                    var i = +cell.getAttribute('data-i');
                    if (!session.view.letters[i]) return { type: 'cell', i: i };
                }
                return null;
            },
            onHover: function (target) {
                clearDropMarks();
                if (!target) return;
                if (target.type === 'cell') cells[target.i].classList.add('drop');
                else $('rack').classList.add('drop');
            },
            onDrop: function (el, target) {
                var t = session && tileById(el.getAttribute('data-tile'));
                if (!t) return;
                if (target && target.type === 'cell') placeTile(t, target.i);
                else if (target && target.type === 'rack') returnToRack(t, target.x);
                session.selected = null;
                refresh();
            },
            onTap: function (el) {
                var t = session && tileById(el.getAttribute('data-tile'));
                if (!t) return;
                if (t.cell >= 0) { t.cell = -1; session.selected = null; }
                else session.selected = session.selected === t.id ? null : t.id;
                refresh();
            }
        });

        // Appui sur une case vide : y pose la lettre sélectionnée.
        $('board').addEventListener('click', function (e) {
            if (!session || session.selected === null || e.target.closest('.tile')) return;
            var cell = e.target.closest('.cell');
            var t = tileById(session.selected);
            if (!cell || !t || !myTurn()) return;
            placeTile(t, +cell.getAttribute('data-i'));
            session.selected = null;
            refresh();
        });
    }

    // ------------------------------------------------------------------ déroulement

    function moveText(last) {
        var who = nameOf(last.player);
        var mine = last.player === session.seat && session.mode === 'solo';
        if (last.type === 'pass') {
            if (!last.swapped) return who + (mine ? ' passez' : ' passe');
            return who + (mine ? ' échangez ' : ' échange ') + last.swapped + (last.swapped > 1 ? ' lettres' : ' lettre');
        }
        var stolen = 0;
        last.stolen.forEach(function (n) { stolen += n; });
        var text = who + ' : +' + last.gained;
        if (stolen) text += ' (' + stolen + (stolen > 1 ? ' volées)' : ' volée)');
        return text;
    }

    /*
     * Montre le dernier coup par étapes : lettres posées, cases capturées,
     * puis plateau vidé si un coin étoilé a été touché.
     */
    function animate(before, done) {
        var s = session, st = s.state, last = st.last;
        Wordox.Drag.cancel();
        s.animating = true;
        s.preview = null;

        function step(ms, fn) {
            setTimeout(function () { if (session === s) fn(); }, ms);
        }
        function finish() {
            s.view = viewOf(st);
            s.popCells = {};
            s.animating = false;
            done();
        }

        if (!last) return finish();
        setStatus(moveText(last));
        if (last.type !== 'move') {
            s.view = viewOf(st);
            s.view.current = last.player;
            renderAll(true);
            return step(900, finish);
        }

        var view = {
            letters: before.letters.slice(), owners: before.owners.slice(),
            banked: before.banked.slice(), current: last.player
        };
        s.lastCells = {};
        s.popCells = {};
        last.placements.forEach(function (pl) {
            view.letters[pl.i] = pl.l;
            view.owners[pl.i] = last.player;
            s.lastCells[pl.i] = true;
            if (last.player !== s.seat) s.popCells[pl.i] = true;
        });
        s.view = view;
        renderAll(true);

        step(last.player === s.seat ? 150 : 550, function () {
            last.cells.forEach(function (i) { view.owners[i] = last.player; });
            renderAll(true);
            if (!last.star) return step(700, finish);
            step(700, function () {
                $('board').classList.add('resetting');
                setStatus('★ Plateau vidé : les scores sont figés');
                step(650, function () {
                    $('board').classList.remove('resetting');
                    s.lastCells = {};
                    finish();
                });
            });
        });
    }

    // Exécute une action de jeu tout de suite, ou après l'animation en cours.
    function enqueue(job) {
        if (session.animating) session.queue.push(job);
        else job();
    }

    /*
     * Applique une action (coup ou passe) sur l'état de la partie dont cet appareil a la charge
     * (solo ou hôte), puis diffuse, sauvegarde et anime.
     */
    function commit(action) {
        var s = session, before = s.view;
        var res = action();
        if (!res.ok) return res;
        if (s.mode === 'host') s.peer.send({ t: 'state', game: online.game, state: Rules.viewFor(s.state, 1) });
        if (s.mode === 'solo') store(SAVE_KEY, s.state.over ? null : s.state);
        syncHand();
        animate(before, nextTurn);
        return res;
    }

    function nextTurn() {
        var s = session, st = s.state;
        s.waiting = false;
        renderAll();
        if (st.over) return showEnd();
        // Actions reçues pendant l'animation ; chacune peut en lancer une nouvelle.
        while (s.queue.length && !s.animating) s.queue.shift()();
        if (s.animating || session !== s) return;
        if (s.mode === 'solo' && st.players[st.current].kind === 'ai') aiTurn();
    }

    function aiTurn() {
        var s = session, st = s.state, me = st.current, turn = st.turn, started = Date.now();
        var ctx = {
            letters: st.letters, owners: st.owners, banked: st.banked, rack: st.racks[me],
            me: me, nPlayers: st.players.length, target: st.target
        };
        think(ctx, st.players[me].level, function (choice) {
            setTimeout(function () {
                if (session !== s || st.turn !== turn || st.over) return;
                var res = choice.pass
                    ? commit(function () { return Rules.applyPass(st, choice.swap); })
                    : commit(function () { return Rules.applyMove(st, choice.placements, isWord); });
                if (!res.ok) commit(function () { return Rules.applyPass(st, []); });
            }, Math.max(0, AI_DELAY - (Date.now() - started)));
        });
    }

    function playPending() {
        if (!myTurn()) return;
        var s = session, placements = pending();
        if (!placements.length) return;
        var check = Rules.checkMove(s.state.letters, placements, isWord);
        if (!check.ok) return setStatus(check.error, true);
        if (s.mode === 'guest') {
            s.waiting = true;
            s.peer.send({ t: 'move', placements: placements });
            renderButtons();
            return;
        }
        var res = commit(function () { return Rules.applyMove(s.state, placements, isWord); });
        if (!res.ok) setStatus(res.error, true);
    }

    function passTurn(swap) {
        if (!myTurn()) return;
        var s = session;
        recallAll();
        if (s.mode === 'guest') {
            s.waiting = true;
            s.peer.send({ t: 'pass', swap: swap });
            refresh();
            return;
        }
        var res = commit(function () { return Rules.applyPass(s.state, swap); });
        if (!res.ok) setStatus(res.error, true);
    }

    function openPassModal() {
        if (!myTurn()) return;
        recallAll();
        refresh();
        var rack = $('swap-rack');
        rack.innerHTML = '';
        session.hand.forEach(function (t) {
            var el = document.createElement('button');
            el.type = 'button';
            el.className = 'tile p' + session.seat;
            el.textContent = t.l;
            el.setAttribute('aria-pressed', 'false');
            rack.appendChild(el);
        });
        updatePassButton();
        openModal('modal-pass');
    }

    function updatePassButton() {
        var n = $('swap-rack').querySelectorAll('.selected').length;
        $('pass-confirm').textContent = n ? 'Échanger ' + n + (n > 1 ? ' lettres' : ' lettre') + ' et passer' : 'Passer sans échanger';
    }

    function showEnd() {
        var s = session, st = s.state;
        var order = st.players.map(function (pl, p) { return p; }).sort(function (a, b) {
            return Rules.score(st, b) - Rules.score(st, a);
        });
        var title;
        if (st.winners.length > 1) title = 'Égalité !';
        else if (st.winners[0] === s.seat) title = 'Victoire !';
        else title = nameOf(st.winners[0]) + ' gagne';
        $('end-title').textContent = title;
        $('end-sub').textContent = Rules.score(st, order[0]) >= st.target
            ? 'Objectif de ' + st.target + ' points atteint'
            : 'Tout le monde a passé : le meilleur score l’emporte';
        $('modal-end').classList.toggle('won', st.winners.indexOf(s.seat) >= 0);
        $('end-ranking').innerHTML = order.map(function (p, rank) {
            return '<li class="' + (st.winners.indexOf(p) >= 0 ? 'winner' : '') + '">' +
                '<span class="tile p' + p + '">' + (rank + 1) + '</span>' +
                '<span class="name">' + esc(nameOf(p)) + '</span>' +
                '<span class="points">' + Rules.score(st, p) + '</span></li>';
        }).join('');
        $('end-hint').textContent = '';
        $('end-again').disabled = false;
        openModal('modal-end');
    }

    // Reprend la partie solo sauvegardée, s'il y en a une.
    function resumeSolo() {
        var saved = load(SAVE_KEY);
        if (saved && saved.letters && saved.players) return begin('solo', 0, saved, null);
        store(SAVE_KEY, null);
        markPlaying(false);
        show('home');
    }

    function leaveGame() {
        Wordox.Drag.cancel();
        if (online.peer) { online.peer.close(); online.peer = null; }
        markPlaying(false);
        session = null;
        closeModals();
        show('home');
    }

    // ------------------------------------------------------------------ partie en ligne

    function cleanName(name) {
        return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 12);
    }

    function onlineError(text) {
        if (online.peer) { online.peer.close(); online.peer = null; }
        $('online-setup').hidden = false;
        $('online-wait').hidden = true;
        $('online-error').textContent = text || '';
    }

    function openOnline(code) {
        onlineError('');
        $('online-name').value = load(NAME_KEY) || '';
        $('online-code').value = code || '';
        show('online');
    }

    function connect(role, code) {
        online.name = cleanName($('online-name').value) || (role === 'host' ? 'Bleu' : 'Rouge');
        store(NAME_KEY, cleanName($('online-name').value) || null);
        online.role = role;
        online.remoteName = '';
        $('online-error').textContent = '';
        $('online-setup').hidden = true;
        $('online-wait').hidden = false;
        $('online-invite').hidden = true;
        $('online-status').textContent = 'Connexion au serveur…';

        var peer = new Wordox.Peer({
            signalUrl: CONFIG.signalUrl,
            onStatus: function () { $('online-status').textContent = 'Adversaire trouvé, connexion en cours…'; },
            onOpen: function () { peer.send({ t: 'hello', name: online.name }); },
            onMessage: function (msg) { if (online.peer === peer) onPeerMessage(msg); },
            onError: function (text) { if (online.peer === peer) onlineError(text); },
            onClose: function () {
                if (online.peer !== peer) return;
                online.peer = null;
                if (session && session.peer === peer) {
                    Wordox.Drag.cancel();
                    closeModals();
                    openModal('modal-lost');
                } else {
                    onlineError('La connexion avec votre adversaire a été perdue.');
                }
            }
        });
        online.peer = peer;

        var started = role === 'host' ? peer.host().then(function (created) {
            // Une lettre par caractère du code ; copyInvite relit le code dans textContent.
            $('online-code-display').innerHTML = String(created).split('').map(function (c, k) {
                return '<span class="tile p' + (k % 4) + '">' + esc(c) + '</span>';
            }).join('');
            $('online-invite').hidden = false;
            $('online-status').textContent = 'En attente de votre adversaire…';
        }) : peer.join(code).then(function () {
            $('online-status').textContent = 'Connexion à la partie ' + code + '…';
        });
        started.catch(function (err) {
            if (online.peer === peer) onlineError(err.message);
        });
    }

    function startOnlineGame() {
        var players = [
            { name: online.name, kind: 'human' },
            { name: online.remoteName || 'Rouge', kind: 'remote' }
        ];
        var state = Rules.createGame(players, online.target);
        online.game++;
        online.peer.send({ t: 'state', game: online.game, state: Rules.viewFor(state, 1) });
        begin('host', 0, state, online.peer);
    }

    function sanitizePlacements(list) {
        if (!Array.isArray(list) || !list.length || list.length > Rules.RACK_SIZE) return null;
        return list.map(function (pl) {
            return { i: pl && pl.i === (pl.i | 0) ? pl.i : -1, l: String(pl && pl.l).slice(0, 1) };
        });
    }

    function onPeerMessage(msg) {
        var peer = online.peer;
        if (!msg || typeof msg !== 'object') return;

        if (msg.t === 'hello') {
            online.remoteName = cleanName(msg.name);
            if (online.role === 'host' && !session) startOnlineGame();
            return;
        }

        if (online.role === 'guest') {
            if (msg.t === 'state' && msg.state) {
                if (!session || session.peer !== peer || msg.game !== online.game) {
                    online.game = msg.game;
                    begin('guest', 1, msg.state, peer);
                    return;
                }
                enqueue(function () {
                    var before = session.view;
                    session.state = msg.state;
                    syncHand();
                    animate(before, nextTurn);
                });
            } else if (msg.t === 'reject' && session) {
                session.waiting = false;
                refresh();
                setStatus(String(msg.error || 'Coup refusé.'), true);
            }
            return;
        }

        // Hôte : l'invité demande à jouer.
        if (!session || session.peer !== peer) return;
        if (msg.t === 'rematch') {
            if (session.state.over) startOnlineGame();
            return;
        }
        if (msg.t !== 'move' && msg.t !== 'pass') return;
        enqueue(function () {
            var st = session.state, res;
            if (st.over || st.current !== 1) {
                res = { ok: false, error: Rules.ERRORS.turn };
            } else if (msg.t === 'move') {
                var placements = sanitizePlacements(msg.placements);
                res = placements ? commit(function () { return Rules.applyMove(st, placements, isWord); })
                    : { ok: false, error: Rules.ERRORS.empty };
            } else {
                var swap = Array.isArray(msg.swap) ? msg.swap.slice(0, Rules.RACK_SIZE).map(String) : [];
                res = commit(function () { return Rules.applyPass(st, swap); });
            }
            if (!res.ok) peer.send({ t: 'reject', error: res.error });
        });
    }

    function copyInvite() {
        var url = location.origin + location.pathname + '?join=' + $('online-code-display').textContent;
        var done = function () {
            $('online-copy').textContent = 'Lien copié !';
            setTimeout(function () { $('online-copy').textContent = 'Copier le lien d\'invitation'; }, 2000);
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(done, function () { window.prompt('Lien d\'invitation :', url); });
        } else {
            var area = document.createElement('textarea');
            area.value = url;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { /* copie refusée */ }
            document.body.removeChild(area);
            if (ok) done();
            else window.prompt('Lien d\'invitation :', url);
        }
    }

    // ------------------------------------------------------------------ branchements

    function bindUI() {
        // Accueil
        $('home-solo').addEventListener('click', function () { renderSoloSetup(); show('solo'); });
        $('home-online').addEventListener('click', function () { openOnline(''); });
        $('home-rules').addEventListener('click', function () { openModal('modal-rules'); });
        $('home-resume').addEventListener('click', resumeSolo);
        document.addEventListener('click', function (e) {
            if (!e.target.closest) return;
            var go = e.target.closest('[data-go]');
            if (go) show(go.getAttribute('data-go'));
            if (e.target.closest('[data-close]')) closeModals();
        });

        // Réglages solo
        $('solo-count').addEventListener('click', function (e) {
            var n = +e.target.getAttribute('data-n');
            if (!n) return;
            setup.count = n;
            renderSoloSetup();
        });
        $('solo-levels').addEventListener('input', function (e) {
            var k = e.target.getAttribute('data-ai');
            if (k === null) return;
            setup.levels[+k] = +e.target.value;
            e.target.style.setProperty('--fill', levelFill(+e.target.value));
            e.target.parentNode.querySelector('output').textContent = levelLabel(+e.target.value);
        });
        bindStepper($('solo-target'), function () { return setup.target; }, function (v) { setup.target = v; });
        $('solo-start').addEventListener('click', startSolo);

        // En ligne
        bindStepper($('online-target'), function () { return online.target; }, function (v) { online.target = v; });
        $('online-create').addEventListener('click', function () { connect('host'); });
        $('online-join').addEventListener('click', function () {
            var code = $('online-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (code.length !== 5) return onlineError('Le code d\'une partie comporte 5 caractères.');
            connect('guest', code);
        });
        $('online-code').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') $('online-join').click();
        });
        $('online-copy').addEventListener('click', copyInvite);
        $('online-cancel').addEventListener('click', function () { onlineError(''); });
        $('online-back').addEventListener('click', function () { onlineError(''); show('home'); });

        // Partie
        $('btn-play').addEventListener('click', playPending);
        $('btn-recall').addEventListener('click', function () { recallAll(); refresh(); });
        $('btn-shuffle').addEventListener('click', function () {
            Rules.shuffle(session.hand, Math.random);
            session.selected = null;
            refresh();
        });
        $('btn-pass').addEventListener('click', openPassModal);
        $('swap-rack').addEventListener('click', function (e) {
            if (!e.target.classList.contains('tile')) return;
            var on = e.target.classList.toggle('selected');
            e.target.setAttribute('aria-pressed', on ? 'true' : 'false');
            updatePassButton();
        });
        $('pass-confirm').addEventListener('click', function () {
            var swap = [], chosen = $('swap-rack').querySelectorAll('.selected');
            for (var k = 0; k < chosen.length; k++) swap.push(chosen[k].textContent);
            closeModals();
            passTurn(swap);
        });
        $('btn-quit').addEventListener('click', function () {
            if (session.state.over) return showEnd(); // la fenêtre de fin propose le retour au menu
            $('quit-text').textContent = session.mode === 'solo'
                ? 'La partie est sauvegardée : vous pourrez la reprendre depuis le menu.'
                : 'Votre adversaire sera déconnecté et la partie sera perdue.';
            openModal('modal-quit');
        });
        $('quit-confirm').addEventListener('click', leaveGame);
        $('lost-menu').addEventListener('click', leaveGame);
        $('end-menu').addEventListener('click', leaveGame);
        $('end-again').addEventListener('click', function () {
            if (session.mode === 'solo') {
                var st = session.state;
                var players = st.players.map(function (pl) { return { name: pl.name, kind: pl.kind, level: pl.level }; });
                begin('solo', 0, Rules.createGame(players, st.target), null);
            } else if (session.mode === 'host') {
                startOnlineGame();
            } else {
                session.peer.send({ t: 'rematch' });
                $('end-again').disabled = true;
                $('end-hint').textContent = 'Demande envoyée à votre adversaire…';
            }
        });

        document.addEventListener('keydown', function (e) {
            if (!session || $('screen-game').hidden || document.querySelector('.modal:not([hidden])')) return;
            if (e.key === 'Enter') { e.preventDefault(); playPending(); }
            else if (e.key === 'Escape') { recallAll(); refresh(); }
        });

        // Une partie en ligne ne survit pas au rechargement de la page : le navigateur demande confirmation.
        window.addEventListener('beforeunload', function (e) {
            if (!session || session.mode === 'solo' || session.state.over) return;
            e.preventDefault();
            e.returnValue = '';
        });

        // Fermeture ou rechargement de la page : prévient l'adversaire.
        window.addEventListener('pagehide', function () {
            if (online.peer) online.peer.close();
        });

        window.addEventListener('resize', layout);
        if (window.ResizeObserver) new ResizeObserver(layout).observe($('board-wrap'));
    }

    function init() {
        var saved = load(SETUP_KEY);
        if (saved && saved.levels && saved.levels.length === 3) {
            setup.count = Math.max(1, Math.min(3, saved.count | 0)) || 1;
            setup.levels = saved.levels.map(function (l) { return Math.max(1, Math.min(10, l | 0)) || 5; });
            setup.target = Math.max(MIN_TARGET, Math.min(MAX_TARGET, saved.target | 0)) || Rules.DEFAULT_TARGET;
        }
        buildBoard();
        bindUI();
        bindDrag();
        show('home');

        loadDictionary().then(function () {
            $('home-loading').hidden = true;
            $('home-solo').disabled = false;
            $('home-online').disabled = false;
            show('home');
            var join = /[?&]join=([A-Za-z0-9]{5})/.exec(location.search);
            if (join) {
                history.replaceState(null, '', location.pathname);
                openOnline(join[1].toUpperCase());
            } else if (wasPlaying()) {
                resumeSolo(); // page rechargée en pleine partie
            }
        }).catch(function () {
            $('home-loading').textContent = 'Impossible de charger le dictionnaire. Rechargez la page.';
            $('home-loading').classList.add('error');
        });
    }

    init();
})();
