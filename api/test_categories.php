<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

$pdo = get_db();
$rows = $pdo->query('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c ORDER BY c.id DESC')->fetchAll();
$rows = array_map(fn($r) => [
    'id' => (int)$r['id'],
    'name' => $r['name'],
    '_count' => ['products' => (int)$r['product_count']],
], $rows);

header('Content-Type: application/json');
echo json_encode($rows, JSON_PRETTY_PRINT);
