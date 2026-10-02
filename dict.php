<?php
/*
 * Sert le dictionnaire compressé, avec mise en cache par le navigateur.
 * L'URL est versionnée par index.php (?v=date de modification).
 */
$file = dirname(__FILE__) . '/dict/words.txt';
if (!is_file($file)) {
    header('HTTP/1.1 404 Not Found');
    exit('Dictionnaire introuvable');
}

$etag = '"' . filemtime($file) . '-' . filesize($file) . '"';
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=31536000');
header('ETag: ' . $etag);

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    header('HTTP/1.1 304 Not Modified');
    exit;
}

if (extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    ob_start('ob_gzhandler');
}
readfile($file);
