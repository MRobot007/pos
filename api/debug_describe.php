<?php
require_once __DIR__ . '/db.php';
$pdo = get_db();
$s = $pdo->query('DESCRIBE products');
echo json_encode($s->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);
