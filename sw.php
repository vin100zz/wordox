<?php
// Une nouvelle version du cache à chaque changement, sans étape de compilation.
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache');

$root = dirname(__FILE__);
$files = array('index.php', 'dict.php', 'dict/words.txt', 'manifest.webmanifest', 'sw.php');
foreach (array('css/*.css', 'js/*.js', 'fonts/*.woff2', 'icons/*') as $pattern) {
    foreach (glob($root . '/' . $pattern) as $file) {
        $files[] = substr($file, strlen($root) + 1);
    }
}
$hash = hash_init('sha256');
$jsVersion = 0;
foreach (glob($root . '/js/*.js') as $file) {
    $jsVersion = max($jsVersion, filemtime($file));
}
$precache = array('index.php');
foreach ($files as $file) {
    hash_update($hash, $file . ':' . filemtime($root . '/' . $file));
    hash_update_file($hash, $root . '/' . $file);
    if (preg_match('/^(css|js|fonts|icons)\//', $file) || $file === 'manifest.webmanifest') {
        // Les URL simples couvrent les polices, le manifeste et ses icônes.
        $precache[] = $file;
        $precache[] = $file . '?v=' . filemtime($root . '/' . $file);
    }
}
$precache[] = 'dict.php?v=' . filemtime($root . '/dict/words.txt');
// Les imports du worker utilisent tous la version du script le plus récent.
foreach (array('ai-worker', 'rules', 'dict', 'ai') as $script) {
    $precache[] = 'js/' . $script . '.js?v=' . $jsVersion;
}
echo 'const VERSION = ' . json_encode(hash_final($hash)) . ";\n";
echo 'const PRECACHE = ' . json_encode(array_values(array_unique($precache))) . ";\n";
readfile($root . '/js/service-worker.js');
