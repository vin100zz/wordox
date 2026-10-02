/*
 * Wordox - connexion pair-à-pair entre deux navigateurs (WebRTC DataChannel).
 * Le serveur PHP (api/signal.php) ne sert qu'à échanger l'offre et la réponse de connexion.
 *
 *   var peer = new Wordox.Peer({ signalUrl, onOpen, onMessage, onClose, onError });
 *   peer.host().then(function (code) { ... });   // crée un salon, attend l'invité
 *   peer.join(code);                             // rejoint un salon
 *   peer.send({ ... });  peer.close();
 */
(function (root) {
    'use strict';

    var ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
    var POLL_DELAY = 1000;
    var ICE_TIMEOUT = 3000;
    var CONNECT_TIMEOUT = 30000;
    var DISCONNECT_GRACE = 7000; // délai avant de considérer une coupure réseau comme définitive

    var MESSAGES = {
        notfound: 'Cette partie n\'existe pas ou a expiré.',
        full: 'Cette partie est déjà complète.',
        storage: 'Le serveur ne peut pas créer de partie (dossier data/ non inscriptible).',
        network: 'Serveur injoignable. Vérifiez votre connexion.',
        timeout: 'La connexion directe entre les deux appareils a échoué.',
        unsupported: 'Ce navigateur ne permet pas les connexions pair-à-pair.'
    };

    function Peer(opts) {
        this.opts = opts;
        this.role = null;
        this.code = '';
        this.token = '';
        this.since = 0;
        this.pc = null;
        this.channel = null;
        this.open = false;
        this.closed = false;
        this.pollTimer = null;
        this.connectTimer = null;
        this.lostTimer = null;
    }

    Peer.prototype.request = function (params) {
        var body = new URLSearchParams();
        for (var k in params) body.append(k, params[k]);
        return fetch(this.opts.signalUrl, { method: 'POST', body: body, cache: 'no-store' })
            .then(function (res) { return res.json(); })
            .catch(function () { return { ok: false, error: 'network' }; });
    };

    Peer.prototype.fail = function (code) {
        if (this.closed) return;
        this.close();
        if (this.opts.onError) this.opts.onError(MESSAGES[code] || MESSAGES.network);
    };

    Peer.prototype.host = function () {
        var self = this;
        if (!root.RTCPeerConnection) return Promise.reject(new Error(MESSAGES.unsupported));
        this.role = 'host';
        return this.request({ action: 'create' }).then(function (res) {
            if (!res.ok) throw new Error(MESSAGES[res.error] || MESSAGES.network);
            self.code = res.code;
            self.token = res.token;
            self.poll();
            return res.code;
        });
    };

    Peer.prototype.join = function (code) {
        var self = this;
        if (!root.RTCPeerConnection) return Promise.reject(new Error(MESSAGES.unsupported));
        this.role = 'guest';
        return this.request({ action: 'join', code: code }).then(function (res) {
            if (!res.ok) throw new Error(MESSAGES[res.error] || MESSAGES.network);
            self.code = code;
            self.token = res.token;
            self.startConnectTimer();
            self.poll();
        });
    };

    Peer.prototype.startConnectTimer = function () {
        var self = this;
        clearTimeout(this.connectTimer);
        this.connectTimer = setTimeout(function () {
            if (!self.open) self.fail('timeout');
        }, CONNECT_TIMEOUT);
    };

    // Interroge le serveur tant que la connexion directe n'est pas établie.
    Peer.prototype.poll = function () {
        var self = this;
        if (this.closed || this.open) return;
        this.request({ action: 'poll', code: this.code, token: this.token, since: this.since }).then(function (res) {
            if (self.closed || self.open) return;
            if (res.ok) {
                self.since = res.next;
                res.msgs.forEach(function (raw) {
                    try { self.onSignal(JSON.parse(raw)); } catch (e) { /* message illisible : ignoré */ }
                });
            } else if (res.error === 'notfound') {
                return self.fail('notfound');
            }
            self.pollTimer = setTimeout(function () { self.poll(); }, POLL_DELAY);
        });
    };

    Peer.prototype.signal = function (msg) {
        return this.request({ action: 'send', code: this.code, token: this.token, msg: JSON.stringify(msg) });
    };

    Peer.prototype.createConnection = function () {
        var self = this;
        var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.pc = pc;
        pc.oniceconnectionstatechange = function () {
            var state = pc.iceConnectionState;
            clearTimeout(self.lostTimer);
            if (state === 'failed') {
                if (self.open) self.lost();
                else self.fail('timeout');
            } else if (state === 'disconnected' && self.open) {
                // Coupure passagère possible : on laisse un peu de temps au réseau pour revenir.
                self.lostTimer = setTimeout(function () { self.lost(); }, DISCONNECT_GRACE);
            }
        };
        return pc;
    };

    // Attend que le navigateur ait listé ses adresses, pour envoyer une description complète en une fois.
    Peer.prototype.gathered = function () {
        var pc = this.pc;
        return new Promise(function (resolve) {
            if (pc.iceGatheringState === 'complete') return resolve();
            var timer = setTimeout(resolve, ICE_TIMEOUT);
            pc.addEventListener('icegatheringstatechange', function () {
                if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); }
            });
        });
    };

    Peer.prototype.onSignal = function (msg) {
        var self = this, pc;
        if (msg.type === 'joined' && this.role === 'host' && !this.pc) {
            if (this.opts.onStatus) this.opts.onStatus('connecting');
            this.startConnectTimer();
            pc = this.createConnection();
            this.attach(pc.createDataChannel('wordox'));
            pc.createOffer()
                .then(function (offer) { return pc.setLocalDescription(offer); })
                .then(function () { return self.gathered(); })
                .then(function () { return self.signal({ type: 'offer', sdp: pc.localDescription.sdp }); })
                .catch(function () { self.fail('timeout'); });
        } else if (msg.type === 'offer' && this.role === 'guest' && !this.pc) {
            pc = this.createConnection();
            pc.ondatachannel = function (e) { self.attach(e.channel); };
            pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
                .then(function () { return pc.createAnswer(); })
                .then(function (answer) { return pc.setLocalDescription(answer); })
                .then(function () { return self.gathered(); })
                .then(function () { return self.signal({ type: 'answer', sdp: pc.localDescription.sdp }); })
                .catch(function () { self.fail('timeout'); });
        } else if (msg.type === 'answer' && this.role === 'host' && this.pc) {
            this.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
                .catch(function () { self.fail('timeout'); });
        }
    };

    Peer.prototype.attach = function (channel) {
        var self = this;
        this.channel = channel;
        channel.onopen = function () {
            self.open = true;
            clearTimeout(self.pollTimer);
            clearTimeout(self.connectTimer);
            if (self.opts.onOpen) self.opts.onOpen();
        };
        channel.onmessage = function (e) {
            var msg;
            try { msg = JSON.parse(e.data); } catch (err) { return; }
            if (msg && msg.t === 'bye') return self.lost();
            if (self.opts.onMessage) self.opts.onMessage(msg);
        };
        channel.onclose = function () { self.lost(); };
    };

    // La connexion établie a été perdue (l'autre joueur est parti ou le réseau a coupé).
    Peer.prototype.lost = function () {
        if (this.closed) return;
        var wasOpen = this.open;
        this.close();
        if (wasOpen && this.opts.onClose) this.opts.onClose();
    };

    Peer.prototype.send = function (msg) {
        if (this.open && this.channel && this.channel.readyState === 'open') {
            this.channel.send(JSON.stringify(msg));
            return true;
        }
        return false;
    };

    Peer.prototype.close = function () {
        this.send({ t: 'bye' }); // prévient l'autre joueur, qui sinon ne le saurait qu'après un long délai
        this.closed = true;
        this.open = false;
        clearTimeout(this.pollTimer);
        clearTimeout(this.connectTimer);
        clearTimeout(this.lostTimer);
        try { if (this.channel) this.channel.close(); } catch (e) { /* déjà fermé */ }
        try { if (this.pc) this.pc.close(); } catch (e) { /* déjà fermé */ }
    };

    root.Wordox = root.Wordox || {};
    root.Wordox.Peer = Peer;
})(typeof self !== 'undefined' ? self : this);
