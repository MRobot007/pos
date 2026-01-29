<?php
// Temporary utility to reset default admin accounts.
// Run once via http://localhost/POS%20Project/api/reset-owner.php then delete this file for security.

require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

try {
    $pdo = get_db();

    $ownerHash = password_hash('admin123', PASSWORD_DEFAULT);
    $managerHash = password_hash('admin123', PASSWORD_DEFAULT);

    $pdo->prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,1)
                   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), active = 1')
        ->execute(['Owner', 'owner@spiritedwines.com', $ownerHash, 'OWNER']);

    $pdo->prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,1)
                   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), active = 1')
        ->execute(['Manager', 'manager@spiritedwines.com', $managerHash, 'MANAGER']);

    echo json_encode(['status' => 'ok', 'message' => 'Owner and Manager passwords reset to admin123']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
