<?php
require_once __DIR__ . '/api/db.php';
$pdo = get_db();
$stmt = $pdo->query('SELECT * FROM sales ORDER BY id DESC LIMIT 5');
$sales = $stmt->fetchAll();
echo json_encode($sales, JSON_PRETTY_PRINT);
