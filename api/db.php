<?php
require_once __DIR__ . '/config.php';

function get_db(): PDO {
    global $CONFIG;
    static $pdo = null;
    if ($pdo) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $CONFIG['db']['host'],
        $CONFIG['db']['port'],
        $CONFIG['db']['name'],
        $CONFIG['db']['charset']
    );

    $pdo = new PDO($dsn, $CONFIG['db']['user'], $CONFIG['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function pdo_try(callable $fn) {
    try {
        return $fn();
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Server error', 'detail' => $e->getMessage()]);
        exit;
    }
}
