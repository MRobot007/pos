<?php
require_once __DIR__ . '/api/db.php';
$pdo = get_db();
try {
    $stmt = $pdo->query("SELECT low_stock_threshold, COUNT(*) as count FROM products GROUP BY low_stock_threshold");
    $summary = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $stmt2 = $pdo->query("SELECT name, stock, low_stock_threshold FROM products WHERE stock <= low_stock_threshold LIMIT 10");
    $lowStockProducts = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'summary' => $summary,
        'examples_low_stock' => $lowStockProducts
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
