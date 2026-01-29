<?php
require_once __DIR__ . '/db.php';
$pdo = get_db();
$start = microtime(true);
$rows = $pdo->query('SELECT p.*, c.id AS cat_id, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC')->fetchAll();
$end = microtime(true);
echo json_encode([
    'count' => count($rows),
    'time' => $end - $start,
    'memory' => memory_get_peak_usage() / 1024 / 1024 . ' MB'
]);
