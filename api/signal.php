<?php
/*
 * Mise en relation de deux joueurs pour une connexion pair-à-pair (WebRTC).
 * Le serveur ne fait que transmettre les messages d'établissement de la connexion ;
 * la partie elle-même circule ensuite directement entre les deux navigateurs.
 *
 * Actions (paramètre "action") :
 *   create               -> { ok, code, token }          crée un salon, l'appelant est l'hôte
 *   join   code          -> { ok, token }                rejoint le salon comme invité
 *   send   code token msg-> { ok }                       dépose un message pour l'autre joueur
 *   poll   code token since -> { ok, msgs, next }        lit les messages reçus depuis "since"
 *
 * Stockage : un fichier par salon dans data/rooms. Compatible PHP 5.3+.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

define('ROOM_DIR', dirname(dirname(__FILE__)) . '/data/rooms');
define('ROOM_TTL', 3600);        // durée de vie d'un salon, en secondes
define('MAX_MSG_SIZE', 16384);   // taille maximale d'un message
define('MAX_MSGS', 60);          // nombre maximal de messages par file
// Empêche la lecture directe du fichier si le dossier data/ n'est pas protégé par le serveur web.
define('ROOM_GUARD', "<?php exit; ?>\n");

function reply($data)
{
    echo json_encode($data);
    exit;
}

function fail($error)
{
    reply(array('ok' => false, 'error' => $error));
}

function param($name)
{
    if (isset($_POST[$name])) return (string) $_POST[$name];
    if (isset($_GET[$name])) return (string) $_GET[$name];
    return '';
}

function random_string($length, $alphabet)
{
    $out = '';
    $max = strlen($alphabet) - 1;
    $bytes = function_exists('openssl_random_pseudo_bytes') ? openssl_random_pseudo_bytes($length) : false;
    for ($i = 0; $i < $length; $i++) {
        $n = ($bytes !== false && strlen($bytes) === $length) ? ord($bytes[$i]) : mt_rand(0, 255);
        $out .= $alphabet[$n % ($max + 1)];
    }
    return $out;
}

function room_path($code)
{
    return ROOM_DIR . '/' . $code . '.php';
}

function valid_code($code)
{
    return (bool) preg_match('/^[A-Z2-9]{5}$/', $code);
}

// Ouvre le salon avec un verrou exclusif. Retourne array(handle, room) ou false.
function open_room($code)
{
    $path = room_path($code);
    if (!is_file($path)) return false;
    $handle = fopen($path, 'r+');
    if (!$handle) return false;
    flock($handle, LOCK_EX);
    $raw = stream_get_contents($handle);
    $room = json_decode(substr($raw, strlen(ROOM_GUARD)), true);
    if (!is_array($room) || time() - $room['created'] > ROOM_TTL) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return false;
    }
    return array($handle, $room);
}

function close_room($handle, $room = null)
{
    if ($room !== null) {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, ROOM_GUARD . json_encode($room));
        fflush($handle);
    }
    flock($handle, LOCK_UN);
    fclose($handle);
}

function purge_rooms()
{
    $files = glob(ROOM_DIR . '/*.php');
    if (!$files) return;
    foreach ($files as $file) {
        if (time() - filemtime($file) > ROOM_TTL) @unlink($file);
    }
}

// Retourne le rôle ('host' ou 'guest') correspondant au jeton, ou false.
function role_of($room, $token)
{
    if ($token === '') return false;
    if ($room['host'] === $token) return 'host';
    if ($room['guest'] === $token) return 'guest';
    return false;
}

if (!is_dir(ROOM_DIR) && !@mkdir(ROOM_DIR, 0775, true)) {
    fail('storage');
}

$action = param('action');
$code = strtoupper(trim(param('code')));
$token = param('token');

if ($action === 'create') {
    purge_rooms();
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($try = 0; $try < 20; $try++) {
        $code = random_string(5, $alphabet);
        // Mode 'x' : échoue si le salon existe déjà.
        $handle = @fopen(room_path($code), 'x');
        if ($handle) break;
    }
    if (empty($handle)) fail('storage');
    $token = random_string(24, 'abcdefghijklmnopqrstuvwxyz0123456789');
    $room = array(
        'created' => time(),
        'host' => $token,
        'guest' => '',
        'queue' => array('host' => array(), 'guest' => array())
    );
    flock($handle, LOCK_EX);
    close_room($handle, $room);
    reply(array('ok' => true, 'code' => $code, 'token' => $token));
}

if (!valid_code($code)) fail('notfound');
$opened = open_room($code);
if (!$opened) fail('notfound');
list($handle, $room) = $opened;

if ($action === 'join') {
    if ($room['guest'] !== '') {
        close_room($handle);
        fail('full');
    }
    $token = random_string(24, 'abcdefghijklmnopqrstuvwxyz0123456789');
    $room['guest'] = $token;
    $room['queue']['host'][] = json_encode(array('type' => 'joined'));
    close_room($handle, $room);
    reply(array('ok' => true, 'token' => $token));
}

$role = role_of($room, $token);
if (!$role) {
    close_room($handle);
    fail('forbidden');
}
$other = $role === 'host' ? 'guest' : 'host';

if ($action === 'send') {
    $msg = param('msg');
    if ($msg === '' || strlen($msg) > MAX_MSG_SIZE || json_decode($msg) === null) {
        close_room($handle);
        fail('badmsg');
    }
    if (count($room['queue'][$other]) >= MAX_MSGS) {
        close_room($handle);
        fail('toomany');
    }
    $room['queue'][$other][] = $msg;
    close_room($handle, $room);
    reply(array('ok' => true));
}

if ($action === 'poll') {
    $since = max(0, (int) param('since'));
    $queue = $room['queue'][$role];
    close_room($handle);
    reply(array(
        'ok' => true,
        'msgs' => array_slice($queue, $since),
        'next' => count($queue)
    ));
}

close_room($handle);
fail('badaction');
