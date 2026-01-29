<?php
require_once __DIR__ . '/db.php';
$pdo = get_db();
$row = $pdo->query('SELECT * FROM products LIMIT 1')->fetch();
echo json_encode($row, JSON_PRETTY_PRINT);
