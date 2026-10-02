/*
 * Wordox - glisser-déposer des lettres.
 * Un seul code pour la souris, le doigt et le stylet (Pointer Events).
 *
 *   Wordox.Drag.attach(root, {
 *       canDrag:  function (tile) -> booléen,
 *       targetAt: function (x, y, pointerX, pointerY) -> cible (objet quelconque) ou null,
 *                 (x, y) est le centre de la lettre affichée, (pointerX, pointerY) le doigt ou la souris
 *       onHover:  function (cible ou null),
 *       onDrop:   function (tile, cible ou null),
 *       onTap:    function (tile),
 *       size:     function () -> taille en pixels de la lettre en cours de déplacement
 *   });
 */
(function (root) {
    'use strict';

    var THRESHOLD = 6; // déplacement minimal, en pixels, pour distinguer un glisser d'un simple appui
    var active = null;

    function attach(container, opts) {
        container.addEventListener('pointerdown', function (e) {
            if (active) return;
            var tile = e.target.closest ? e.target.closest('.tile') : null;
            if (!tile || !container.contains(tile) || !opts.canDrag(tile)) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            active = {
                tile: tile, opts: opts, pointerId: e.pointerId, touch: e.pointerType !== 'mouse',
                startX: e.clientX, startY: e.clientY, ghost: null, target: null
            };
            try { tile.setPointerCapture(e.pointerId); } catch (err) { /* capture indisponible */ }
            window.addEventListener('pointermove', onMove, { passive: false });
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onCancel);
        });
        // Empêche le menu contextuel (appui long sur mobile) et le glisser natif du navigateur.
        container.addEventListener('contextmenu', function (e) {
            if (e.target.closest && e.target.closest('.tile')) e.preventDefault();
        });
        container.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }

    function startDrag() {
        var size = active.opts.size();
        var ghost = active.tile.cloneNode(true);
        ghost.className = active.tile.className.replace(/\b(selected|pending|pop|last|capture)\b/g, '') + ' ghost';
        ghost.style.width = ghost.style.height = size + 'px';
        ghost.style.fontSize = (size * 0.58) + 'px';
        document.body.appendChild(ghost);
        active.ghost = ghost;
        active.size = size;
        active.tile.classList.add('dragging');
        document.body.classList.add('is-dragging');
    }

    function move(e) {
        // Au doigt, la lettre est affichée au-dessus du point de contact pour rester visible.
        var cx = e.clientX;
        var cy = e.clientY - (active.touch ? active.size * 0.7 : 0);
        active.ghost.style.transform = 'translate(' + (cx - active.size / 2) + 'px,' + (cy - active.size / 2) + 'px) scale(1.12)';
        var target = active.opts.targetAt(cx, cy, e.clientX, e.clientY);
        active.target = target;
        active.opts.onHover(target);
    }

    function onMove(e) {
        if (!active || e.pointerId !== active.pointerId) return;
        if (!active.ghost) {
            var dx = e.clientX - active.startX, dy = e.clientY - active.startY;
            if (dx * dx + dy * dy < THRESHOLD * THRESHOLD) return;
            startDrag();
        }
        e.preventDefault();
        move(e);
    }

    function finish() {
        var done = active;
        active = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        try { done.tile.releasePointerCapture(done.pointerId); } catch (err) { /* déjà relâché */ }
        if (done.ghost) {
            done.ghost.parentNode.removeChild(done.ghost);
            done.tile.classList.remove('dragging');
            document.body.classList.remove('is-dragging');
            done.opts.onHover(null);
        }
        return done;
    }

    function onUp(e) {
        if (!active || e.pointerId !== active.pointerId) return;
        var done = finish();
        if (done.ghost) done.opts.onDrop(done.tile, done.target);
        else done.opts.onTap(done.tile);
    }

    function onCancel(e) {
        if (!active || e.pointerId !== active.pointerId) return;
        finish();
    }

    // Abandonne le déplacement en cours (avant de redessiner le plateau, par exemple).
    function cancel() {
        if (active) finish();
    }

    root.Wordox = root.Wordox || {};
    root.Wordox.Drag = { attach: attach, cancel: cancel, isActive: function () { return !!active; } };
})(typeof self !== 'undefined' ? self : this);
