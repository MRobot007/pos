<?php
// Basic configuration for database and security
$CONFIG = [
    'db' => [
        'host' => '127.0.0.1',
        'name' => 'pos_project',
        'user' => 'root',
        'pass' => '',
        'port' => 3306,
        'charset' => 'utf8mb4',
    ],
    'security' => [
        // Replace with your own long random secret for token HMAC
        'token_secret' => 'change-this-secret-please',
        'token_ttl_hours' => 168, // 7 days
    ],
];
