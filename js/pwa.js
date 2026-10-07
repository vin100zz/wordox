(function () {
    'use strict';

    var button = document.getElementById('home-install');
    var status = document.getElementById('install-status');
    var installPrompt = null;
    var standalone = window.matchMedia('(display-mode: standalone)');

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        installPrompt = event;
        button.hidden = standalone.matches;
    });

    button.addEventListener('click', function () {
        if (!installPrompt) return;
        var prompt = installPrompt;
        installPrompt = null;
        button.hidden = true;
        status.hidden = true;
        prompt.prompt().then(function () {
            return prompt.userChoice;
        }).catch(function () {
            status.textContent = 'Pour installer Wordox, ouvrez le menu du navigateur puis « Ajouter à l’écran d’accueil ».';
            status.hidden = false;
        });
    });

    window.addEventListener('appinstalled', function () {
        installPrompt = null;
        button.hidden = true;
        status.textContent = 'Wordox est installé. Retrouvez-le sur votre écran d’accueil.';
        status.hidden = standalone.matches;
    });

    if ('serviceWorker' in navigator && window.isSecureContext) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw.php', { scope: './', updateViaCache: 'none' })
                .catch(function (error) {
                    console.warn('Wordox : mode hors connexion indisponible.', error);
                });
        });
    }
})();
