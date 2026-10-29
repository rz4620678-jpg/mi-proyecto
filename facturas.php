<?php
declare(strict_types=1);

$index = __DIR__ . '/index.html';
if (is_file($index)) {
    readfile($index);
    exit;
}

$distIndex = __DIR__ . '/frontend/dist/index.html';
if (!is_file($distIndex)) {
    http_response_code(500);
    exit('No se encontró la interfaz compilada. Genera frontend/dist o instala el ZIP de publicación.');
}

$html = file_get_contents($distIndex);
if ($html === false) {
    http_response_code(500);
    exit('No se pudo leer la interfaz compilada.');
}

echo str_replace('./assets/', './frontend/dist/assets/', $html);
