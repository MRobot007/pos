<?php
require_once __DIR__ . '/db.php';
$pdo = get_db();

$rows = $pdo->query('SELECT p.*, c.id AS cat_id, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC')->fetchAll();
$out = array_map(function($r) {
    return [
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'sku' => $r['sku'],
        'barcode' => $r['barcode'],
        'brand' => $r['brand'],
        'isAlcohol' => (bool)$r['is_alcohol'],
        'mrp' => $r['mrp'],
        'bottleSize' => $r['bottle_size'],
        'price' => $r['price'],
        'stock' => (int)$r['stock'],
        'lowStockThreshold' => (int)($r['low_stock_threshold'] ?? 10),
        'category' => ['id' => (int)$r['cat_id'], 'name' => $r['cat_name'] ?? 'Unassigned'],
    ];
}, $rows);

$json = json_encode($out);
if ($json === false) {
    echo "JSON Error: " . json_last_error_msg() . "\n";
    // Identify which row is causing the problem
    foreach ($out as $i => $row) {
        if (json_encode($row) === false) {
            echo "Error in row $i (ID: {$row['id']}): " . json_last_error_msg() . "\n";
            print_r($row);
            break;
        }
    }
} else {
    echo "JSON Success. Length: " . strlen($json) . "\n";
}
