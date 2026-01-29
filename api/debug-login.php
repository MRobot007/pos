<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json');
$pdo = get_db();
$email = 'owner@spiritedwines.com';
$pass = 'admin123';
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user) {
    echo json_encode(['step' => 'fetch', 'ok' => false, 'reason' => 'no user']);
    exit;
}
$verified = password_verify($pass, $user['password_hash']);
echo json_encode([
    'step' => 'verify',
    'ok' => $verified,
    'hash' => $user['password_hash'],
    'password' => $pass,
]);
