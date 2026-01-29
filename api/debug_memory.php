<?php
require_once __DIR__ . '/db.php';
$pdo = get_db();

$start = microtime(true);
$initial_mem = memory_get_usage();

$rows = $pdo->query('SELECT p.*, c.id AS cat_id, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC')->fetchAll();
$fetch_mem = memory_get_usage();

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
$map_mem = memory_get_usage();

$json = json_encode($out);
$json_mem = memory_get_usage();
$json_len = strlen($json);

$end = microtime(true);

echo "Count: " . count($rows) . "\n";
echo "Time: " . ($end - $start) . "s\n";
echo "Initial Mem: " . ($initial_mem / 1024 / 1024) . " MB\n";
echo "Fetch Mem: " . ($fetch_mem / 1024 / 1024) . " MB\n";
echo "Map Mem: " . ($map_mem / 1024 / 1024) . " MB\n";
echo "JSON Mem: " . ($json_mem / 1024 / 1024) . " MB\n";
echo "JSON Size: " . ($json_len / 1024 / 1024) . " MB\n";
echo "Peak Mem: " . (memory_get_peak_usage() / 1024 / 1024) . " MB\n";
