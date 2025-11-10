<?php
require_once 'functions.php';

$videoId = isset($_GET['id']) ? basename($_GET['id']) : '';
$type = isset($_GET['type']) ? basename($_GET['type']) : '';

$allowed = ['default','0','1','2','hqdefault','sddefault','mqdefault'];
if (!$videoId || !in_array($type, $allowed, true)) {
    http_response_code(400);
    exit;
}

$file = rtrim(CACHE_DIR, '/')."/{$videoId}_{$type}.jpg";
if (!is_file($file)) {
    http_response_code(404);
    exit;
}

header('Content-Type: image/jpeg');
readfile($file);

