<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=pos_project', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("ALTER TABLE products ADD COLUMN low_stock_threshold INT DEFAULT 10");
    echo "Column added successfully\n";
} catch (PDOException $e) {
    if ($e->getCode() == '42S21') {
        echo "Column already exists\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
