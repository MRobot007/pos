<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$pdo = get_db();
$users = $pdo->query('SELECT id, email, role, active FROM users')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($users, JSON_PRETTY_PRINT);
