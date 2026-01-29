<?php
// Simulate a request to /api/products
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/POS-System-Spirited-Wines--main/api/products';

// Capture output
ob_start();
require_once __DIR__ . '/index.php';
$output = ob_get_clean();

echo "Status Code: " . http_response_code() . "\n";
echo "Response Body: " . substr($output, 0, 500) . (strlen($output) > 500 ? "..." : "") . "\n";
if (strlen($output) > 0) {
    $data = json_decode($output, true);
    if (is_array($data)) {
        echo "Product Count: " . count($data) . "\n";
        if (count($data) > 0) {
            echo "First Product: " . json_encode($data[0], JSON_PRETTY_PRINT) . "\n";
        }
    } else {
        echo "Failed to decode JSON\n";
    }
}
?>
