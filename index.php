<?php
// Ajoute la date de modification du fichier à son URL, pour que le navigateur recharge les nouvelles versions.
function asset($path)
{
    $full = dirname(__FILE__) . '/' . $path;
    return $path . '?v=' . (is_file($full) ? filemtime($full) : 0);
}

// Icône au trait (24 × 24), dessinée avec la couleur du texte.
function icon($name)
{
    static $paths = array(
        'close'   => '<path d="M6 6l12 12M18 6L6 18"/>',
        'back'    => '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
        'chevron' => '<path d="M9 5l7 7-7 7"/>',
        'flag'    => '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
        'cpu'     => '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M19 9h3M19 15h3M2 9h3M2 15h3"/>',
        'users'   => '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6"/><path d="M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
        'play'    => '<path d="M7 5l12 7-12 7V5z" style="fill:currentColor"/>',
        'plus'    => '<path d="M5 12h14M12 5v14"/>',
        'enter'   => '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
        'pass'    => '<path d="M5 5l9 7-9 7V5z"/><path d="M19 5v14"/>',
        'shuffle' => '<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
        'recall'  => '<path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
        'check'   => '<path d="M20 6L9 17l-5-5"/>'
    );
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' . $paths[$name] . '</svg>';
}

function star($class)
{
    return '<svg class="star ' . $class . '" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
}

// Le worker charge lui-même rules.js, dict.js et ai.js : sa version suit le plus récent des scripts.
$jsVersion = 0;
foreach (glob(dirname(__FILE__) . '/js/*.js') as $script) {
    $jsVersion = max($jsVersion, filemtime($script));
}

$config = array(
    'dictUrl' => 'dict.php?v=' . @filemtime(dirname(__FILE__) . '/dict/words.txt'),
    'workerUrl' => 'js/ai-worker.js?v=' . $jsVersion,
    'signalUrl' => 'api/signal.php'
);

$logo = '<span class="tile p0">W</span><span class="tile p1">O</span><span class="tile p2">R</span><span class="tile p3">D</span><span class="tile p0">O</span><span class="tile p1">X</span>';
?><!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#f4f2fb">
    <title>Wordox</title>
    <link rel="icon" href="<?php echo asset('icons/favicon.svg'); ?>" type="image/svg+xml">
    <link rel="icon" href="<?php echo asset('icons/favicon-32.png'); ?>" type="image/png" sizes="32x32">
    <link rel="apple-touch-icon" href="<?php echo asset('icons/apple-touch-icon.png'); ?>" sizes="180x180">
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="preload" href="fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="fonts/figtree-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="<?php echo asset('css/style.css'); ?>">
</head>
<body>
<div id="app">

    <!-- Accueil -->
    <section class="screen" id="screen-home">
        <div class="panel home">
            <div class="home-deco" aria-hidden="true">
                <span class="tile p0">M</span><span class="tile p2">O</span><span class="tile p1">T</span><span class="tile p3">S</span>
                <?php echo star(''); ?>
            </div>
            <h1 class="logo" aria-label="Wordox"><?php echo $logo; ?></h1>
            <p class="tagline">Posez vos mots, volez ceux des autres.</p>
            <div class="menu">
                <button class="btn choice primary" id="home-solo" disabled>
                    <span class="choice-icon"><?php echo icon('cpu'); ?></span>
                    <span class="choice-text"><strong>Solo contre l'ordinateur</strong><small>1 à 3 adversaires, niveaux 1 à 10</small></span>
                    <?php echo icon('chevron'); ?>
                </button>
                <button class="btn choice" id="home-online" disabled>
                    <span class="choice-icon red"><?php echo icon('users'); ?></span>
                    <span class="choice-text"><strong>Deux joueurs en ligne</strong><small>Invitez un ami avec un code</small></span>
                    <?php echo icon('chevron'); ?>
                </button>
                <button class="btn choice" id="home-resume" hidden>
                    <span class="choice-icon gold"><?php echo icon('play'); ?></span>
                    <span class="choice-text"><strong>Reprendre la partie</strong><small>Votre partie solo est sauvegardée</small></span>
                    <?php echo icon('chevron'); ?>
                </button>
            </div>
            <button class="btn link" id="home-rules">Règles du jeu</button>
            <button class="btn link" id="home-install" hidden>Installer Wordox</button>
            <p class="hint" id="install-status" role="status" hidden></p>
            <p class="hint" id="home-loading">Chargement du dictionnaire…</p>
        </div>
    </section>

    <!-- Réglages d'une partie solo -->
    <section class="screen" id="screen-solo" hidden>
        <div class="panel">
            <header class="panel-head">
                <button class="btn icon" data-go="home" aria-label="Retour"><?php echo icon('back'); ?></button>
                <h2>Partie solo</h2>
            </header>
            <div class="field">
                <span class="label">Nombre d'adversaires</span>
                <div class="segmented" id="solo-count">
                    <button data-n="1">1</button><button data-n="2">2</button><button data-n="3">3</button>
                </div>
            </div>
            <div class="field">
                <span class="label">Niveau des ordinateurs</span>
                <div id="solo-levels"></div>
            </div>
            <div class="card row">
                <span class="row-label">Points pour gagner</span>
                <div class="stepper" id="solo-target">
                    <button data-step="-5" aria-label="Moins">&minus;</button><output>25</output><button data-step="5" aria-label="Plus">+</button>
                </div>
            </div>
            <button class="btn big primary" id="solo-start">Jouer</button>
        </div>
    </section>

    <!-- Partie à deux en ligne -->
    <section class="screen" id="screen-online" hidden>
        <div class="panel">
            <header class="panel-head">
                <button class="btn icon" id="online-back" aria-label="Retour"><?php echo icon('back'); ?></button>
                <h2>Deux joueurs en ligne</h2>
            </header>
            <div id="online-setup">
                <div class="field">
                    <label class="label" for="online-name">Votre prénom</label>
                    <input type="text" id="online-name" maxlength="12" autocomplete="off" placeholder="Joueur">
                </div>
                <div class="card">
                    <h3><span class="card-icon p0"><?php echo icon('plus'); ?></span>Créer une partie</h3>
                    <div class="row">
                        <span class="row-label">Points pour gagner</span>
                        <div class="stepper" id="online-target">
                            <button data-step="-5" aria-label="Moins">&minus;</button><output>25</output><button data-step="5" aria-label="Plus">+</button>
                        </div>
                    </div>
                    <button class="btn primary" id="online-create">Créer et inviter</button>
                </div>
                <div class="card">
                    <h3><span class="card-icon p1"><?php echo icon('enter'); ?></span>Rejoindre une partie</h3>
                    <div class="join-row">
                        <input type="text" id="online-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" aria-label="Code de la partie">
                        <button class="btn join" id="online-join">Rejoindre</button>
                    </div>
                </div>
            </div>
            <div id="online-wait" hidden>
                <div class="card center">
                    <div id="online-invite">
                        <p class="label">Code de la partie</p>
                        <div class="code" id="online-code-display"></div>
                        <button class="btn" id="online-copy">Copier le lien d'invitation</button>
                    </div>
                    <p class="hint" id="online-status"></p>
                    <button class="btn" id="online-cancel">Annuler</button>
                </div>
            </div>
            <p class="error" id="online-error" role="alert"></p>
        </div>
    </section>

    <!-- Partie -->
    <section class="screen game" id="screen-game" hidden>
        <header class="topbar">
            <button class="btn icon" id="btn-quit" aria-label="Quitter la partie"><?php echo icon('close'); ?></button>
            <div class="brand" aria-hidden="true"><?php echo $logo; ?></div>
            <div class="status" id="status" role="status" aria-live="polite"></div>
            <div class="goal" title="Points pour gagner"><?php echo icon('flag'); ?><span class="sr-only">Objectif :</span><span id="goal"></span></div>
        </header>
        <div class="scores" id="scores"></div>
        <div class="board-wrap" id="board-wrap"><div class="board" id="board"></div></div>
        <div class="rack-wrap" id="rack-wrap"><div class="rack" id="rack"></div></div>
        <div class="actions">
            <button class="btn tool" id="btn-pass"><?php echo icon('pass'); ?><span>Passer</span></button>
            <button class="btn tool" id="btn-shuffle"><?php echo icon('shuffle'); ?><span>Mélanger</span></button>
            <button class="btn tool" id="btn-recall"><?php echo icon('recall'); ?><span>Rappeler</span></button>
            <button class="btn primary" id="btn-play"><?php echo icon('check'); ?><span>Valider</span></button>
        </div>
    </section>
</div>

<!-- Fenêtres -->
<div class="modal" id="modal-rules" hidden>
    <div class="modal-box">
        <h2>Règles du jeu</h2>
        <ul class="rules">
            <li>À votre tour, posez des lettres de votre chevalet sur une même ligne ou colonne pour former un mot d'au moins 2 lettres.</li>
            <li>Le premier mot passe par la case centrale ; les suivants doivent toucher des lettres déjà posées.</li>
            <li><strong>Capture :</strong> toutes les lettres des mots que vous formez prennent votre couleur, y compris celles des adversaires.</li>
            <li><strong>Score :</strong> 1 point par case de votre couleur sur le plateau.</li>
            <li><strong>Coins étoilés :</strong> poser une lettre sur un coin vide le plateau. Les points de chacun sont alors figés et ne peuvent plus être volés.</li>
            <li>Le premier joueur qui atteint l'objectif gagne.</li>
            <li>Vous pouvez passer votre tour et en profiter pour échanger des lettres.</li>
        </ul>
        <p class="hint">Dictionnaire : Officiel du Scrabble, édition 2004 (ODS4).</p>
        <div class="modal-actions"><button class="btn primary" data-close>Fermer</button></div>
    </div>
</div>

<div class="modal" id="modal-pass" hidden>
    <div class="modal-box">
        <h2>Passer votre tour</h2>
        <p>Touchez les lettres que vous voulez échanger (facultatif).</p>
        <div class="rack swap-rack" id="swap-rack"></div>
        <div class="modal-actions">
            <button class="btn" data-close>Annuler</button>
            <button class="btn primary" id="pass-confirm">Passer</button>
        </div>
    </div>
</div>

<div class="modal" id="modal-quit" hidden>
    <div class="modal-box">
        <h2>Quitter la partie ?</h2>
        <p id="quit-text"></p>
        <div class="modal-actions">
            <button class="btn" data-close>Continuer à jouer</button>
            <button class="btn primary" id="quit-confirm">Quitter</button>
        </div>
    </div>
</div>

<div class="modal end" id="modal-end" hidden>
    <div class="modal-box">
        <div class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <?php echo star('end-star'); ?>
        <h2 id="end-title"></h2>
        <p class="end-sub" id="end-sub"></p>
        <ol class="ranking" id="end-ranking"></ol>
        <p class="hint" id="end-hint"></p>
        <div class="modal-actions">
            <button class="btn big primary" id="end-again">Rejouer</button>
            <button class="btn dark" data-close>Voir le plateau</button>
            <button class="btn dark" id="end-menu">Menu</button>
        </div>
    </div>
</div>

<div class="modal" id="modal-lost" hidden>
    <div class="modal-box">
        <h2>Connexion perdue</h2>
        <p id="lost-text">Votre adversaire a quitté la partie.</p>
        <div class="modal-actions"><button class="btn primary" id="lost-menu">Retour au menu</button></div>
    </div>
</div>

<script>window.WORDOX_CONFIG = <?php echo json_encode($config); ?>;</script>
<script src="<?php echo asset('js/rules.js'); ?>"></script>
<script src="<?php echo asset('js/dict.js'); ?>"></script>
<script src="<?php echo asset('js/net.js'); ?>"></script>
<script src="<?php echo asset('js/dnd.js'); ?>"></script>
<script src="<?php echo asset('js/app.js'); ?>"></script>
<script src="<?php echo asset('js/pwa.js'); ?>"></script>
</body>
</html>
