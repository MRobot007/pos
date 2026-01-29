<?php
require_once __DIR__ . '/db.php';
$pdo = get_db();
$pCount = $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
$cCount = $pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn();
echo "Products: $pCount\n";
echo "Categories: $cCount\n";

$cats = $pdo->query('SELECT * FROM categories')->fetchAll(PDO::FETCH_ASSOC);
print_r($cats);
?>
