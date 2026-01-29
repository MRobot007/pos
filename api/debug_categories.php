<?php
require_once __DIR__ . '/db.php';
$pdo = get_db();
$rows = $pdo->query('SELECT * FROM categories')->fetchAll();
echo json_encode($rows, JSON_PRETTY_PRINT);
