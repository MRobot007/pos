<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

function bearer_token(): ?string {
    $headers = getallheaders();
    if (!isset($headers['Authorization'])) return null;
    if (preg_match('/Bearer\s+(.*)$/i', $headers['Authorization'], $m)) {
        return trim($m[1]);
    }
    return null;
}

function make_token(int $userId): string {
    global $CONFIG;
    $secret = $CONFIG['security']['token_secret'];
    $payload = $userId . '|' . time();
    $sig = hash_hmac('sha256', $payload, $secret);
    return base64_encode($payload . '|' . $sig);
}

function parse_token(string $token): ?array {
    global $CONFIG;
    $decoded = base64_decode($token, true);
    if (!$decoded) return null;
    $parts = explode('|', $decoded);
    if (count($parts) !== 3) return null;
    [$userId, $ts, $sig] = $parts;
    $expected = hash_hmac('sha256', $userId . '|' . $ts, $CONFIG['security']['token_secret']);
    if (!hash_equals($expected, $sig)) return null;
    if ((time() - (int)$ts) > ($CONFIG['security']['token_ttl_hours'] * 3600)) return null;
    return ['user_id' => (int)$userId, 'ts' => (int)$ts];
}

function current_user(): ?array {
    $token = bearer_token();
    if (!$token) return null;
    $parsed = parse_token($token);
    if (!$parsed) return null;
    $pdo = get_db();
    $stmt = $pdo->prepare('SELECT id, name, email, role, active FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$parsed['user_id']]);
    $user = $stmt->fetch();
    if (!$user || !$user['active']) return null;
    return $user;
}

function require_auth(array $roles = []): array {
    $user = current_user();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    if ($roles && !in_array($user['role'], $roles, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    return $user;
}
