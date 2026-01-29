<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

$method = $_SERVER['REQUEST_METHOD'];
$rawPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';

// Normalize to always start from "/api" segment regardless of directory depth
$apiPos = strpos($rawPath, '/api');
$path = $apiPos !== false ? substr($rawPath, $apiPos) : '/';
$path = '/' . ltrim(preg_replace('#/+#', '/', $path), '/');

function json_input(): array {
    static $parsed = null;
    if ($parsed !== null) {
        return $parsed;
    }

    $raw = file_get_contents('php://input');

    if ($raw !== false && $raw !== '') {
        $data = json_decode($raw, true);
        if (is_array($data)) {
            return $parsed = $data;
        }
    }

    if (!empty($_POST)) {
        return $parsed = $_POST;
    }

    if ($raw) {
        parse_str($raw, $form); // handles urlencoded fallback
        if (!empty($form)) {
            return $parsed = $form;
        }
    }

    return $parsed = [];
}

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function not_found() {
    global $method, $path, $rawPath;
    respond([
        'error' => 'Not found',
        'debug' => [
            'method' => $method,
            'path' => $path,
            'rawPath' => $rawPath
        ]
    ], 404);
}

function ensure_column(PDO $pdo, string $table, string $column, string $definition): void {
    try {
        $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
    } catch (Throwable $e) {
        // column likely exists already
    }
}

function log_action(PDO $pdo, ?int $userId, string $action, array $details = []): void {
    $stmt = $pdo->prepare('INSERT INTO audit_logs (user_id, action, details) VALUES (?,?,?)');
    $stmt->execute([$userId, $action, json_encode($details)]);
}

function ensure_table_defaults(PDO $pdo): void {
    // Simple bootstrap: ensure at least one owner user exists and default accounts are present
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      phone VARCHAR(30) NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM("OWNER","MANAGER","CASHIER") NOT NULL DEFAULT "CASHIER",
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        ensure_column($pdo, 'users', 'phone', 'VARCHAR(30) NULL');

    $pdo->exec('CREATE TABLE IF NOT EXISTS user_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT,
      name VARCHAR(200) NOT NULL,
      sku VARCHAR(100) NOT NULL,
      barcode VARCHAR(120),
      brand VARCHAR(120),
      is_alcohol TINYINT(1) DEFAULT 0,
      mrp DECIMAL(10,2) DEFAULT 0,
      bottle_size VARCHAR(50),
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      stock INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(category_id),
      UNIQUE KEY uniq_sku (sku),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        ensure_column($pdo, 'products', 'bottle_size', "VARCHAR(50) DEFAULT '750ml'");
        ensure_column($pdo, 'products', 'cost_price', 'DECIMAL(10,2) DEFAULT 0');

    $pdo->exec('CREATE TABLE IF NOT EXISTS registers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
      current_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
      status ENUM("OPEN","CLOSED") NOT NULL DEFAULT "OPEN",
      opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      register_id INT,
      subtotal DECIMAL(10,2) NOT NULL,
      tax DECIMAL(10,2) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      payment_method ENUM("cash","card","split") NOT NULL,
      age_verified TINYINT(1) DEFAULT 0,
      receipt_number VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (register_id) REFERENCES registers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS held_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE IF NOT EXISTS held_bill_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES held_bills(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS suppliers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            contact_name VARCHAR(120),
            phone VARCHAR(30),
            email VARCHAR(150),
            address TEXT,
            terms TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS purchase_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            supplier_id INT NOT NULL,
            status ENUM("DRAFT","ORDERED","RECEIVED","CANCELLED") DEFAULT "DRAFT",
            ordered_at DATETIME,
            received_at DATETIME,
            created_by INT,
            notes TEXT,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS purchase_order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            purchase_order_id INT NOT NULL,
            product_id INT NOT NULL,
            ordered_qty INT NOT NULL,
            received_qty INT DEFAULT 0,
            cost_price DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS promotions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            discount_type ENUM("PERCENT","AMOUNT") NOT NULL,
            discount_value DECIMAL(10,2) NOT NULL,
            start_at DATETIME,
            end_at DATETIME,
            category_id INT,
            active TINYINT(1) DEFAULT 1,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS customer_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            phone VARCHAR(20) UNIQUE,
            loyalty_points INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS customer_purchases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            sale_id INT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customer_profiles(id),
            FOREIGN KEY (sale_id) REFERENCES sales(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS payment_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sale_id INT NOT NULL,
            method ENUM("CASH","CARD","UPI","WALLET") NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            reference VARCHAR(150),
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS receipts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sale_id INT NOT NULL,
            email VARCHAR(150),
            phone VARCHAR(20),
            gift_receipt TINYINT(1) DEFAULT 0,
            receipt_url VARCHAR(255),
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS refunds (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sale_id INT NOT NULL,
            processed_by INT NOT NULL,
            approved_by INT,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sale_id) REFERENCES sales(id),
            FOREIGN KEY (processed_by) REFERENCES users(id),
            FOREIGN KEY (approved_by) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS refund_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            refund_id INT NOT NULL,
            sale_item_id INT NOT NULL,
            quantity INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            restocked TINYINT(1) DEFAULT 0,
            FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE,
            FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

        $pdo->exec('CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            action VARCHAR(150) NOT NULL,
            details JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // seed / re-seed owner & manager defaults if missing
    $ownerPass = password_hash('admin123', PASSWORD_DEFAULT);
    $managerPass = password_hash('admin123', PASSWORD_DEFAULT);

    $ownerExists = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $ownerExists->execute(['owner@spiritedwines.com']);
    if (!$ownerExists->fetchColumn()) {
        $pdo->prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,1)')
            ->execute(['Owner', 'owner@spiritedwines.com', $ownerPass, 'OWNER']);
    }

    $managerExists = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $managerExists->execute(['manager@spiritedwines.com']);
    if (!$managerExists->fetchColumn()) {
        $pdo->prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,1)')
            ->execute(['Manager', 'manager@spiritedwines.com', $managerPass, 'MANAGER']);
    }

    // seed a handful of default categories to help with first-run testing
    $defaultCategories = ['Red Wine', 'White Wine', 'Spirits', 'Accessories'];
    $categoryIds = [];
    $categoryLookup = $pdo->prepare('SELECT id FROM categories WHERE name = ? LIMIT 1');
    $categoryInsert = $pdo->prepare('INSERT INTO categories (name) VALUES (?)');

    foreach ($defaultCategories as $categoryName) {
        $categoryLookup->execute([$categoryName]);
        $categoryId = $categoryLookup->fetchColumn();
        if (!$categoryId) {
            $categoryInsert->execute([$categoryName]);
            $categoryId = (int)$pdo->lastInsertId();
        } else {
            $categoryId = (int)$categoryId;
        }
        $categoryIds[$categoryName] = $categoryId;
    }

    // seed a few representative products if the catalog is empty
    $productCount = (int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    if ($productCount === 0) {
        $defaultProducts = [
            [
                'sku' => 'WINE-RED-CAB750',
                'name' => 'Reserve Cabernet Sauvignon',
                'category' => 'Red Wine',
                'price' => 24.99,
                'cost_price' => 15.5,
                'stock' => 36,
                'brand' => 'Spirited Cellars',
                'mrp' => 27.99,
                'bottle_size' => '750ml',
                'barcode' => '100000000001',
                'is_alcohol' => 1,
            ],
            [
                'sku' => 'WINE-WHT-CHD750',
                'name' => 'Oak Aged Chardonnay',
                'category' => 'White Wine',
                'price' => 21.5,
                'cost_price' => 13.25,
                'stock' => 28,
                'brand' => 'Heritage Vineyards',
                'mrp' => 24.0,
                'bottle_size' => '750ml',
                'barcode' => '100000000002',
                'is_alcohol' => 1,
            ],
            [
                'sku' => 'SPIR-BRB-750',
                'name' => 'Small Batch Bourbon',
                'category' => 'Spirits',
                'price' => 39.99,
                'cost_price' => 28.0,
                'stock' => 18,
                'brand' => 'Old River Distilling',
                'mrp' => 44.99,
                'bottle_size' => '750ml',
                'barcode' => '100000000003',
                'is_alcohol' => 1,
            ],
            [
                'sku' => 'ACC-GLASS-SET',
                'name' => 'Crystal Wine Glass Set (4pc)',
                'category' => 'Accessories',
                'price' => 34.5,
                'cost_price' => 20.0,
                'stock' => 12,
                'brand' => 'Cellar Essentials',
                'mrp' => 39.95,
                'bottle_size' => 'N/A',
                'barcode' => '100000000004',
                'is_alcohol' => 0,
            ],
        ];

        $productInsert = $pdo->prepare('INSERT INTO products (category_id, name, sku, barcode, brand, is_alcohol, mrp, bottle_size, cost_price, price, stock) VALUES (?,?,?,?,?,?,?,?,?,?,?)');

        foreach ($defaultProducts as $product) {
            $categoryId = $categoryIds[$product['category']] ?? null;
            if (!$categoryId) {
                continue;
            }

            $productInsert->execute([
                $categoryId,
                $product['name'],
                $product['sku'],
                $product['barcode'],
                $product['brand'],
                $product['is_alcohol'],
                $product['mrp'],
                $product['bottle_size'],
                $product['cost_price'],
                $product['price'],
                $product['stock'],
            ]);
        }
    }
}

$pdo = get_db();
ensure_table_defaults($pdo);

// ROUTES
if ($method === 'GET' && $path === '/api/health') {
    respond(['status' => 'ok']);
}

if ($method === 'POST' && $path === '/api/auth/login') {
    $data = json_input();
    $email = $data['email'] ?? '';
    $pass = $data['password'] ?? '';
    // normalize email
    $email = trim(strtolower($email));
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pass, $user['password_hash'])) {
        respond(['error' => 'Invalid credentials'], 401);
    }
    if (!(int)$user['active']) respond(['error' => 'User inactive'], 403);
    $token = make_token((int)$user['id']);
    $pdo->prepare('INSERT INTO user_tokens (user_id, token) VALUES (?, ?)')->execute([$user['id'], $token]);
    unset($user['password_hash']);
    respond(['token' => $token, 'user' => $user]);
}

if ($method === 'POST' && preg_match('#^/api/(auth/register|(auth|admin)/users)/?$#', $path)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';
    $role = $data['role'] ?? 'CASHIER';
    if (!$name || !$email || !$password) respond(['error' => 'Missing fields'], 400);

    // Role guard: OWNER can create any role; MANAGER may only create CASHIER
    if ($me['role'] === 'MANAGER' && $role !== 'CASHIER') {
        respond(['error' => 'Managers can only create cashiers'], 403);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    try {
        $pdo->prepare('INSERT INTO users (name, email, phone, password_hash, role, active) VALUES (?,?,?,?,?,1)')
            ->execute([$name, $email, $phone ?: null, $hash, $role]);
    } catch (Throwable $e) {
        respond(['error' => 'Email already exists'], 400);
    }
    respond(['ok' => true]);
}

if ($method === 'GET' && preg_match('#^/api/(auth|admin)/users/?$#', $path)) {
    require_auth(['OWNER', 'MANAGER']);
    $users = $pdo->query('SELECT id, name, email, phone, role, active, created_at FROM users ORDER BY id DESC')->fetchAll();
    respond($users);
}

if ($method === 'PUT' && preg_match('#^/api/(auth|admin)/users/(\d+)$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    $data = json_input();
    $newRole = $data['role'] ?? 'CASHIER';

    // Managers cannot promote to MANAGER/OWNER nor edit OWNER accounts
    if ($me['role'] === 'MANAGER') {
        // fetch target role
        $targetRole = $pdo->prepare('SELECT role FROM users WHERE id = ?');
        $targetRole->execute([$id]);
        $currentRole = $targetRole->fetchColumn();
        if (in_array($currentRole, ['OWNER', 'MANAGER'], true)) {
          respond(['error' => 'Managers cannot modify owners/managers'], 403);
        }
        if ($newRole !== 'CASHIER') {
          respond(['error' => 'Managers can only assign cashier role'], 403);
        }
    }

    $pdo->prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?')
        ->execute([
            $data['name'] ?? '',
            $newRole,
            !empty($data['active']) ? 1 : 0,
            $id,
        ]);
    if (array_key_exists('phone', $data)) {
        $pdo->prepare('UPDATE users SET phone = ? WHERE id = ?')->execute([$data['phone'] ?: null, $id]);
    }
    respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/api/(auth|admin)/users/(\d+)$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    if ($me['role'] === 'MANAGER') {
        $roleStmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
        $roleStmt->execute([$id]);
        $targetRole = $roleStmt->fetchColumn();
        if (in_array($targetRole, ['OWNER', 'MANAGER'], true)) {
            respond(['error' => 'Managers cannot delete owners/managers'], 403);
        }
    }
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^/api/(auth|admin)/users/(\d+)/reset-password$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    $data = json_input();
    $pw = $data['newPassword'] ?? '';
    if (!$pw || strlen($pw) < 6) respond(['error' => 'Invalid password'], 400);
    $hash = password_hash($pw, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $id]);
    respond(['ok' => true]);
}

// Categories
if ($method === 'GET' && preg_match('#^/api/(admin/)?categories/?$#', $path)) {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $rows = $pdo->query('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c ORDER BY c.id DESC')->fetchAll();
    // shape for frontend
    $rows = array_map(fn($r) => [
        'id' => (int)$r['id'],
        'name' => $r['name'],
        '_count' => ['products' => (int)$r['product_count']],
    ], $rows);
    respond($rows);
}

if ($method === 'POST' && preg_match('#^/api/(admin/)?categories/?$#', $path)) {
    require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $name = trim($data['name'] ?? '');
    if (!$name) respond(['error' => 'Name required'], 400);
    $pdo->prepare('INSERT INTO categories (name) VALUES (?)')->execute([$name]);
    respond(['ok' => true]);
}

if ($method === 'PUT' && preg_match('#^/api/(admin/)?categories/(\d+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    $data = json_input();
    $name = trim($data['name'] ?? '');
    $pdo->prepare('UPDATE categories SET name = ? WHERE id = ?')->execute([$name, $id]);
    respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/api/(admin/)?categories/(\d+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    $pdo->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
    respond(['ok' => true]);
}

// Products
if ($method === 'GET' && preg_match('#^/api/(admin/)?products/?$#', $path)) {
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
    respond($out);
}

if ($method === 'GET' && preg_match('#^/api/products/barcode/(.+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $code = $m[1];
    $stmt = $pdo->prepare('SELECT p.*, c.id AS cat_id, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.barcode = ? LIMIT 1');
    $stmt->execute([$code]);
    $r = $stmt->fetch();
    if (!$r) not_found();
    $out = [
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
        'category' => ['id' => (int)$r['cat_id'], 'name' => $r['cat_name'] ?? 'Unassigned'],
    ];
    respond($out);
}

if ($method === 'GET' && $path === '/api/pos/products/search') {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $q = $_GET['q'] ?? '';
    $stmt = $pdo->prepare('SELECT p.*, c.id AS cat_id, c.name AS cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? ORDER BY p.id DESC LIMIT 20');
    $like = '%' . $q . '%';
    $stmt->execute([$like, $like, $like]);
    $rows = $stmt->fetchAll();
    $out = array_map(fn($r) => [
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
        'category' => ['id' => (int)$r['cat_id'], 'name' => $r['cat_name'] ?? 'Unassigned'],
    ], $rows);
    respond($out);
}

if ($method === 'POST' && preg_match('#^/api/(admin/)?products/?$#', $path)) {
    require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $stmt = $pdo->prepare('INSERT INTO products (name, sku, barcode, category_id, price, stock, brand, is_alcohol, mrp, bottle_size) VALUES (?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $data['name'] ?? '',
        $data['sku'] ?? '',
        $data['barcode'] ?? null,
        $data['categoryId'] ?? null,
        $data['price'] ?? 0,
        $data['stock'] ?? 0,
        $data['brand'] ?? null,
        !empty($data['isAlcohol']) ? 1 : 0,
        $data['mrp'] ?? null,
        $data['bottleSize'] ?? null,
    ]);
    respond(['ok' => true]);
}

if ($method === 'PUT' && preg_match('#^/api/(admin/)?products/(\d+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    $data = json_input();
    $stmt = $pdo->prepare('UPDATE products SET name=?, sku=?, barcode=?, category_id=?, price=?, stock=?, brand=?, is_alcohol=?, mrp=?, bottle_size=? WHERE id=?');
    $stmt->execute([
        $data['name'] ?? '',
        $data['sku'] ?? '',
        $data['barcode'] ?? null,
        $data['categoryId'] ?? null,
        $data['price'] ?? 0,
        $data['stock'] ?? 0,
        $data['brand'] ?? null,
        !empty($data['isAlcohol']) ? 1 : 0,
        $data['mrp'] ?? null,
        $data['bottleSize'] ?? null,
        $id,
    ]);
    respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/api/(admin/)?products/(\d+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    $pdo->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
    respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/api/(admin/)?products/?$#', $path)) {
    require_auth(['OWNER']);
    $pdo->beginTransaction();
    try {
        $total = (int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
        if ($total === 0) {
            $pdo->commit();
            respond(['deleted' => 0]);
        }

        // Remove dependent records first to honor foreign key constraints
        $pdo->exec('DELETE FROM refund_items');
        $pdo->exec('DELETE FROM sale_items');
        $pdo->exec('DELETE FROM held_bill_items');
        $pdo->exec('DELETE FROM purchase_order_items');

        $pdo->exec('DELETE FROM products');

        $pdo->commit();
        respond(['deleted' => $total]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(['error' => 'Failed to delete products', 'details' => $e->getMessage()], 500);
    }
}

if ($method === 'PATCH' && preg_match('#^/api/admin/products/(\d+)/stock$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[1];
    $data = json_input();
    $stock = (int)($data['stock'] ?? 0);
    $pdo->prepare('UPDATE products SET stock = ? WHERE id = ?')->execute([$stock, $id]);
    respond(['ok' => true]);
}

// CSV import/export
if ($method === 'GET' && $path === '/api/csv/products') {
    require_auth(['OWNER', 'MANAGER']);
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="products.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['id','name','sku','barcode','category_id','price','stock']);
    $rows = $pdo->query('SELECT id,name,sku,barcode,category_id,price,stock FROM products')->fetchAll();
    foreach ($rows as $r) {
        fputcsv($out, $r);
    }
    exit;
}

if ($method === 'POST' && $path === '/api/csv/products') {
    require_auth(['OWNER', 'MANAGER']);
    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        respond(['error' => 'No file uploaded'], 400);
    }

    $file = $_FILES['file']['tmp_name'];
    $fh = fopen($file, 'r');
    if (!$fh) {
        respond(['error' => 'Unable to read uploaded file'], 400);
    }

    $rawHeader = fgetcsv($fh);
    if (!$rawHeader) {
        respond(['error' => 'CSV file is empty'], 400);
    }

    $headerIndex = [];
    foreach ($rawHeader as $index => $column) {
        $key = strtolower(trim($column));
        if ($key !== '') {
            $headerIndex[$key] = $index;
        }
    }

    $required = ['name', 'sku'];
    $missing = array_diff($required, array_keys($headerIndex));
    if (!empty($missing)) {
        respond([
            'error' => 'CSV header missing required columns',
            'missing' => array_values($missing),
        ], 400);
    }

    $rowNumber = 1; // header already read
    $imported = 0;
    $updated = 0;
    $errors = [];

    $findCategoryId = function (?string $categoryValue) use ($pdo) {
        if ($categoryValue === null || $categoryValue === '') {
            return null;
        }
        if (ctype_digit($categoryValue)) {
            return (int)$categoryValue;
        }
        $categoryValue = trim($categoryValue);
        $stmt = $pdo->prepare('SELECT id FROM categories WHERE name = ? LIMIT 1');
        $stmt->execute([$categoryValue]);
        $id = $stmt->fetchColumn();
        if ($id) {
            return (int)$id;
        }
        $insert = $pdo->prepare('INSERT INTO categories (name) VALUES (?)');
        $insert->execute([$categoryValue]);
        return (int)$pdo->lastInsertId();
    };

    while (($row = fgetcsv($fh)) !== false) {
        $rowNumber++;
        if ($row === [null] || (count($row) === 1 && trim((string)$row[0]) === '')) {
            continue; // skip empty lines
        }

        $get = function (string $column) use ($headerIndex, $row) {
            if (!array_key_exists($column, $headerIndex)) {
                return null;
            }
            $value = $row[$headerIndex[$column]] ?? null;
            return is_string($value) ? trim($value) : $value;
        };

        $name = $get('name');
        $sku = $get('sku');
        if (!$name || !$sku) {
            $errors[] = "Row {$rowNumber}: Missing product name or SKU";
            continue;
        }

        $barcode = $get('barcode') ?: null;
        $categoryId = null;
        if ($catId = $get('category_id')) {
            $categoryId = $findCategoryId($catId);
        } elseif ($catName = $get('category')) {
            $categoryId = $findCategoryId($catName);
        }

        $price = (float)($get('price') ?? 0);
        $costPrice = (float)($get('cost_price') ?? $price);

        $stockRaw = $get('stock');
        if ($stockRaw === null || $stockRaw === '') {
            $stockRaw = $get('quantity') ?? $get('qty');
        }
        $stock = 0;
        if ($stockRaw !== null && $stockRaw !== '') {
            if (is_numeric($stockRaw)) {
                $stock = (int)round((float)$stockRaw);
            } else {
                $normalizedStock = strtolower(trim((string)$stockRaw));
                if (in_array($normalizedStock, ['in stock', 'available', 'active'], true)) {
                    $stock = 1;
                } elseif (in_array($normalizedStock, ['out of stock', 'oos', 'unavailable'], true)) {
                    $stock = 0;
                }
            }
        }

        $brand = $get('brand') ?: null;
        $mrp = (float)($get('mrp') ?? $price);
        $bottleSize = $get('bottle_size') ?: null;

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare('SELECT id FROM products WHERE sku = ? LIMIT 1');
            $stmt->execute([$sku]);
            $existing = $stmt->fetchColumn();

            if ($existing) {
                $update = $pdo->prepare('UPDATE products SET name=?, barcode=?, category_id=?, price=?, cost_price=?, stock=?, brand=?, mrp=?, bottle_size=? WHERE id=?');
                $update->execute([
                    $name,
                    $barcode,
                    $categoryId,
                    $price,
                    $costPrice,
                    $stock,
                    $brand,
                    $mrp,
                    $bottleSize,
                    $existing,
                ]);
                $updated++;
            } else {
                $insert = $pdo->prepare('INSERT INTO products (name, sku, barcode, category_id, price, cost_price, stock, brand, mrp, bottle_size) VALUES (?,?,?,?,?,?,?,?,?,?)');
                $insert->execute([
                    $name,
                    $sku,
                    $barcode,
                    $categoryId,
                    $price,
                    $costPrice,
                    $stock,
                    $brand,
                    $mrp,
                    $bottleSize,
                ]);
                $imported++;
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            $errors[] = "Row {$rowNumber}: " . $e->getMessage();
        }
    }

    respond(['imported' => $imported, 'updated' => $updated, 'errors' => $errors]);
}

// Register
if ($method === 'GET' && $path === '/api/register/current') {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $row = $pdo->query('SELECT * FROM registers WHERE status="OPEN" ORDER BY id DESC LIMIT 1')->fetch();
    if (!$row) not_found();
    respond([
        'id' => (int)$row['id'],
        'openingCash' => $row['opening_cash'],
        'currentCash' => (float)$row['current_cash'],
        'status' => $row['status'],
        'openedAt' => $row['opened_at'],
    ]);
}

if ($method === 'POST' && $path === '/api/register/open') {
    $me = require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $data = json_input();
    $opening = (float)($data['openingCash'] ?? 0);
    // close any open register
    $pdo->exec('UPDATE registers SET status="CLOSED", closed_at = NOW() WHERE status="OPEN"');
    $stmt = $pdo->prepare('INSERT INTO registers (opening_cash, current_cash, status) VALUES (?,?,"OPEN")');
    $stmt->execute([$opening, $opening]);
    $id = $pdo->lastInsertId();
    respond([
        'id' => (int)$id,
        'openingCash' => number_format($opening, 2, '.', ''),
        'currentCash' => $opening,
        'status' => 'OPEN',
    ]);
}

// Sales
if ($method === 'POST' && $path === '/api/sales') {
    $me = require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $data = json_input();
    $items = $data['items'] ?? [];
    if (!$items) respond(['error' => 'No items provided'], 400);

    $registerId = (int)($data['registerId'] ?? 0);
    if ($registerId <= 0) respond(['error' => 'Register required'], 400);

    $basePaymentMethod = strtolower($data['paymentMethod'] ?? 'cash');
    $providedPayments = $data['payments'] ?? null;
    $customerData = $data['customer'] ?? null;
    $loyaltyData = $data['loyalty'] ?? null;
    $discountTotal = (float)($data['discountTotal'] ?? 0);
    $ageVerification = $data['ageVerification'] ?? null;
    $receiptData = $data['receipt'] ?? null;
    $promotionRefs = is_array($data['promotions'] ?? null) ? $data['promotions'] : [];

    $pdo->beginTransaction();
    try {
        // lock register row to ensure it is open during the sale
        $regStmt = $pdo->prepare('SELECT id, status FROM registers WHERE id = ? FOR UPDATE');
        $regStmt->execute([$registerId]);
        $register = $regStmt->fetch();
        if (!$register || $register['status'] !== 'OPEN') {
            throw new Exception('Register is not open');
        }

        $subtotal = 0.0;
        $requiresAgeVerification = false;
        $productSnapshots = [];
        foreach ($items as $it) {
            $pid = (int)($it['productId'] ?? 0);
            $qty = (int)($it['quantity'] ?? 0);
            if ($pid <= 0 || $qty <= 0) {
                throw new Exception('Invalid product line item');
            }
            $stmt = $pdo->prepare('SELECT id, price, stock, is_alcohol, name, sku FROM products WHERE id = ? FOR UPDATE');
            $stmt->execute([$pid]);
            $prod = $stmt->fetch();
            if (!$prod || $prod['stock'] < $qty) {
                throw new Exception('Insufficient stock for product ID ' . $pid);
            }
            $line = (float)$prod['price'] * $qty;
            $subtotal += $line;
            if ((int)$prod['is_alcohol'] === 1) {
                $requiresAgeVerification = true;
            }
            $productSnapshots[] = [
                'id' => (int)$prod['id'],
                'name' => $prod['name'],
                'sku' => $prod['sku'],
                'quantity' => $qty,
                'unitPrice' => (float)$prod['price'],
                'lineTotal' => $line,
            ];
        }

        $subtotal = round($subtotal, 2);
        $tax = round($subtotal * 0.0825, 2);
        $discountTotal = round(max(0.0, min($discountTotal, $subtotal + $tax)), 2);
        $total = round(($subtotal + $tax) - $discountTotal, 2);

        if ($requiresAgeVerification) {
            $ageFlag = !empty($data['ageVerified']) || !empty($ageVerification);
            if (!$ageFlag) {
                throw new Exception('Age verification required for alcohol items');
            }
        }

        // prepare customer information inside the transaction
        $customerId = null;
        $customerName = null;
        $customerPhone = null;
        if (is_array($customerData)) {
            $customerId = isset($customerData['id']) ? (int)$customerData['id'] : null;
            $customerName = isset($customerData['name']) ? trim($customerData['name']) : null;
            $customerPhone = isset($customerData['phone']) ? trim($customerData['phone']) : null;

            if ($customerId) {
                $custStmt = $pdo->prepare('SELECT id FROM customer_profiles WHERE id = ? FOR UPDATE');
                $custStmt->execute([$customerId]);
                if (!$custStmt->fetch()) {
                    throw new Exception('Customer not found');
                }
            } elseif ($customerPhone) {
                $custStmt = $pdo->prepare('SELECT id FROM customer_profiles WHERE phone = ? FOR UPDATE');
                $custStmt->execute([$customerPhone]);
                $existingCustomer = $custStmt->fetch();
                if ($existingCustomer) {
                    $customerId = (int)$existingCustomer['id'];
                } elseif ($customerName) {
                    $insertCust = $pdo->prepare('INSERT INTO customer_profiles (name, phone) VALUES (?, ?)');
                    $insertCust->execute([$customerName, $customerPhone]);
                    $customerId = (int)$pdo->lastInsertId();
                }
            } elseif ($customerName) {
                $insertCust = $pdo->prepare('INSERT INTO customer_profiles (name) VALUES (?)');
                $insertCust->execute([$customerName]);
                $customerId = (int)$pdo->lastInsertId();
            }
        }

        // loyalty adjustments (if any)
        $loyaltyEarn = 0;
        $loyaltyRedeem = 0;
        if ($customerId && is_array($loyaltyData)) {
            $loyaltyRedeem = max(0, (int)($loyaltyData['redeem'] ?? 0));
            $loyaltyEarn = max(0, (int)($loyaltyData['earn'] ?? floor($total / 10)));
            $custPointsStmt = $pdo->prepare('SELECT loyalty_points FROM customer_profiles WHERE id = ? FOR UPDATE');
            $custPointsStmt->execute([$customerId]);
            $currentPoints = (int)$custPointsStmt->fetchColumn();
            if ($loyaltyRedeem > $currentPoints) {
                throw new Exception('Customer does not have enough loyalty points');
            }
            $newPoints = $currentPoints - $loyaltyRedeem + $loyaltyEarn;
            $pdo->prepare('UPDATE customer_profiles SET loyalty_points = ? WHERE id = ?')
                ->execute([$newPoints, $customerId]);
        } elseif ($customerId) {
            $loyaltyEarn = (int)floor($total / 10);
            $pdo->prepare('UPDATE customer_profiles SET loyalty_points = loyalty_points + ? WHERE id = ?')
                ->execute([$loyaltyEarn, $customerId]);
        }

        // payments handling
        $paymentEntries = [];
        if (is_array($providedPayments) && !empty($providedPayments)) {
            $paidTotal = 0.0;
            foreach ($providedPayments as $entry) {
                $method = strtoupper(trim($entry['method'] ?? ''));
                $amount = isset($entry['amount']) ? (float)$entry['amount'] : 0.0;
                if (!in_array($method, ['CASH', 'CARD', 'UPI', 'WALLET'], true)) {
                    throw new Exception('Unsupported payment method: ' . $method);
                }
                if ($amount <= 0) {
                    throw new Exception('Payment amounts must be positive');
                }
                $paidTotal += $amount;
                $paymentEntries[] = [
                    'method' => $method,
                    'amount' => round($amount, 2),
                    'reference' => isset($entry['reference']) ? trim((string)$entry['reference']) : null,
                ];
            }
            if (abs($paidTotal - $total) > 0.05) {
                throw new Exception('Payment totals do not match sale total');
            }
            $primaryPaymentMethod = count($paymentEntries) === 1 ? strtolower($paymentEntries[0]['method']) : 'split';
        } else {
            $primaryPaymentMethod = $basePaymentMethod;
            if ($basePaymentMethod === 'split') {
                $split = $data['splitPayments'] ?? [];
                $cashAmount = isset($split['cash']) ? (float)$split['cash'] : 0.0;
                $cardAmount = isset($split['card']) ? (float)$split['card'] : 0.0;
                $upiAmount = isset($split['upi']) ? (float)$split['upi'] : 0.0;
                $walletAmount = isset($split['wallet']) ? (float)$split['wallet'] : 0.0;
                $splitPaid = $cashAmount + $cardAmount + $upiAmount + $walletAmount;
                if (abs($splitPaid - $total) > 0.05) {
                    throw new Exception('Split amounts do not match sale total');
                }
                if ($cashAmount > 0) $paymentEntries[] = ['method' => 'CASH', 'amount' => round($cashAmount, 2), 'reference' => null];
                if ($cardAmount > 0) $paymentEntries[] = ['method' => 'CARD', 'amount' => round($cardAmount, 2), 'reference' => $split['cardReference'] ?? null];
                if ($upiAmount > 0) $paymentEntries[] = ['method' => 'UPI', 'amount' => round($upiAmount, 2), 'reference' => $split['upiReference'] ?? null];
                if ($walletAmount > 0) $paymentEntries[] = ['method' => 'WALLET', 'amount' => round($walletAmount, 2), 'reference' => $split['walletReference'] ?? null];
            } else {
                $methodMap = [
                    'cash' => 'CASH',
                    'card' => 'CARD',
                    'upi' => 'UPI',
                    'wallet' => 'WALLET',
                ];
                $resolvedMethod = $methodMap[$basePaymentMethod] ?? 'CASH';
                $paymentEntries[] = [
                    'method' => $resolvedMethod,
                    'amount' => round($total, 2),
                    'reference' => isset($data['paymentReference']) ? (string)$data['paymentReference'] : null,
                ];
            }
        }

        if (!in_array($primaryPaymentMethod, ['cash', 'card', 'split'], true)) {
            $primaryPaymentMethod = 'split';
        }

        $receiptNumber = $data['receiptNumber'] ?? ('R' . time());
        $ageVerified = $requiresAgeVerification ? 1 : (!empty($data['ageVerified']) ? 1 : 0);

        $stmt = $pdo->prepare('INSERT INTO sales (register_id, subtotal, tax, total, payment_method, age_verified, receipt_number) VALUES (?,?,?,?,?,?,?)');
        $stmt->execute([$registerId, $subtotal, $tax, $total, $primaryPaymentMethod, $ageVerified, $receiptNumber]);
        $saleId = (int)$pdo->lastInsertId();

        foreach ($productSnapshots as $snapshot) {
            $pdo->prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price, subtotal) VALUES (?,?,?,?,?)')
                ->execute([
                    $saleId,
                    $snapshot['id'],
                    $snapshot['quantity'],
                    $snapshot['unitPrice'],
                    $snapshot['lineTotal'],
                ]);
            $pdo->prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
                ->execute([$snapshot['quantity'], $snapshot['id']]);
        }

        foreach ($paymentEntries as $entry) {
            $pdo->prepare('INSERT INTO payment_records (sale_id, method, amount, reference) VALUES (?,?,?,?)')
                ->execute([$saleId, $entry['method'], $entry['amount'], $entry['reference']]);
        }

        if ($customerId) {
            $pdo->prepare('INSERT INTO customer_purchases (customer_id, sale_id) VALUES (?, ?)')
                ->execute([$customerId, $saleId]);
        }

        if (is_array($receiptData) && (!empty($receiptData['email']) || !empty($receiptData['phone']))) {
            $pdo->prepare('INSERT INTO receipts (sale_id, email, phone, gift_receipt, receipt_url) VALUES (?,?,?,?,?)')
                ->execute([
                    $saleId,
                    $receiptData['email'] ?? null,
                    $receiptData['phone'] ?? null,
                    !empty($receiptData['giftReceipt']) ? 1 : 0,
                    $receiptData['receiptUrl'] ?? null,
                ]);
        }

        // update register cash with only the cash component
        $cashComponent = array_reduce($paymentEntries, function ($carry, $entry) {
            if ($entry['method'] === 'CASH') {
                return $carry + $entry['amount'];
            }
            return $carry;
        }, 0.0);
        if ($cashComponent > 0) {
            $pdo->prepare('UPDATE registers SET current_cash = current_cash + ? WHERE id = ?')
                ->execute([$cashComponent, $registerId]);
        }

        $pdo->commit();

        // audit logging outside of the critical write path
        $auditDetails = [
            'saleId' => $saleId,
            'registerId' => $registerId,
            'subtotal' => $subtotal,
            'tax' => $tax,
            'discount' => $discountTotal,
            'total' => $total,
            'items' => $productSnapshots,
            'customer' => $customerId,
            'loyaltyEarned' => $loyaltyEarn,
            'loyaltyRedeemed' => $loyaltyRedeem,
            'payments' => $paymentEntries,
            'promotions' => $promotionRefs,
        ];
        if ($requiresAgeVerification && is_array($ageVerification)) {
            $auditDetails['ageVerification'] = $ageVerification;
        }
        log_action($pdo, (int)$me['id'], 'sale.created', $auditDetails);

        if ($requiresAgeVerification && is_array($ageVerification)) {
            log_action($pdo, (int)$me['id'], 'sale.ageVerification', $ageVerification);
        }

        respond([
            'id' => $saleId,
            'total' => $total,
            'receiptNumber' => $receiptNumber,
            'customerId' => $customerId,
            'loyalty' => ['earned' => $loyaltyEarn, 'redeemed' => $loyaltyRedeem],
        ]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(['error' => $e->getMessage()], 400);
    }
}

if ($method === 'GET' && $path === '/api/admin/sales') {
    require_auth(['OWNER', 'MANAGER']);
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;
    $total = (int)$pdo->query('SELECT COUNT(*) FROM sales')->fetchColumn();
    $stmt = $pdo->prepare('SELECT * FROM sales ORDER BY id DESC LIMIT ? OFFSET ?');
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->bindValue(2, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $sales = $stmt->fetchAll();
    foreach ($sales as &$s) {
        $itemsStmt = $pdo->prepare('SELECT si.*, p.name, p.sku FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?');
        $itemsStmt->execute([$s['id']]);
        $s['items'] = array_map(fn($r) => [
            'id' => (int)$r['id'],
            'quantity' => (int)$r['quantity'],
            'price' => (float)$r['price'],
            'subtotal' => (float)$r['subtotal'],
            'product' => ['id' => (int)$r['product_id'], 'name' => $r['name'], 'sku' => $r['sku']],
        ], $itemsStmt->fetchAll());

        $paymentsStmt = $pdo->prepare('SELECT method, amount, reference FROM payment_records WHERE sale_id = ?');
        $paymentsStmt->execute([$s['id']]);
        $s['payments'] = array_map(fn($p) => [
            'method' => $p['method'],
            'amount' => (float)$p['amount'],
            'reference' => $p['reference'] ?? null,
        ], $paymentsStmt->fetchAll());

        $custStmt = $pdo->prepare('SELECT cp.id, cp.name, cp.phone, cp.loyalty_points FROM customer_purchases cpr JOIN customer_profiles cp ON cpr.customer_id = cp.id WHERE cpr.sale_id = ? LIMIT 1');
        $custStmt->execute([$s['id']]);
        $s['customer'] = $custStmt->fetch() ?: null;

        $receiptStmt = $pdo->prepare('SELECT email, phone, gift_receipt, receipt_url FROM receipts WHERE sale_id = ? LIMIT 1');
        $receiptStmt->execute([$s['id']]);
        $receiptRow = $receiptStmt->fetch();
        $s['receipt'] = $receiptRow ? [
            'email' => $receiptRow['email'],
            'phone' => $receiptRow['phone'],
            'giftReceipt' => (bool)$receiptRow['gift_receipt'],
            'receiptUrl' => $receiptRow['receipt_url'],
        ] : null;
    }
    respond([
        'sales' => $sales,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'totalPages' => max(1, (int)ceil($total / $limit)),
        ],
    ]);
}

// X report
if ($method === 'GET' && $path === '/api/reports/x-report') {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $reg = $pdo->query('SELECT * FROM registers WHERE status="OPEN" ORDER BY id DESC LIMIT 1')->fetch();
    if (!$reg) not_found();
    $regId = (int)$reg['id'];
    $sales = $pdo->prepare('SELECT id, total, tax, subtotal FROM sales WHERE register_id = ?');
    $sales->execute([$regId]);
    $rows = $sales->fetchAll();
    $totalSales = count($rows);
    $totalRevenue = array_reduce($rows, fn($c, $r) => $c + $r['total'], 0);

    $paymentStmt = $pdo->prepare('SELECT pr.method, pr.amount FROM payment_records pr JOIN sales s ON pr.sale_id = s.id WHERE s.register_id = ?');
    $paymentStmt->execute([$regId]);
    $totalCash = 0.0; $totalCard = 0.0; $totalUpi = 0.0; $totalWallet = 0.0;
    foreach ($paymentStmt->fetchAll() as $payRow) {
        switch ($payRow['method']) {
            case 'CASH':
                $totalCash += (float)$payRow['amount'];
                break;
            case 'CARD':
                $totalCard += (float)$payRow['amount'];
                break;
            case 'UPI':
                $totalUpi += (float)$payRow['amount'];
                break;
            case 'WALLET':
                $totalWallet += (float)$payRow['amount'];
                break;
        }
    }

    // category breakdown
    $catStmt = $pdo->prepare('SELECT c.name, SUM(si.quantity) qty, SUM(si.subtotal) rev FROM sale_items si JOIN products p ON si.product_id=p.id LEFT JOIN categories c ON p.category_id=c.id JOIN sales s ON si.sale_id=s.id WHERE s.register_id=? GROUP BY c.name');
    $catStmt->execute([$regId]);
    $catRows = $catStmt->fetchAll();
    $catMap = [];
    foreach ($catRows as $c) {
        $catMap[$c['name'] ?? 'Unassigned'] = ['quantity' => (int)$c['qty'], 'revenue' => (float)$c['rev']];
    }
    respond([
        'registerId' => $regId,
        'openedAt' => $reg['opened_at'],
        'reportGeneratedAt' => date('c'),
        'totalSales' => $totalSales,
        'totalRevenue' => (float)$totalRevenue,
        'totalCash' => (float)$totalCash,
        'totalCard' => (float)$totalCard,
        'totalUpi' => (float)$totalUpi,
        'totalWallet' => (float)$totalWallet,
        'openingCash' => (float)$reg['opening_cash'],
        'currentCash' => (float)$reg['current_cash'],
        'categoryBreakdown' => $catMap,
    ]);
}

// Dashboard stats
if ($method === 'GET' && $path === '/api/admin/stats') {
    require_auth(['OWNER', 'MANAGER']);
    $totalProducts = (int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    $totalCategories = (int)$pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn();
    $totalSales = (int)$pdo->query('SELECT COUNT(*) FROM sales')->fetchColumn();
    $lowStock = (int)$pdo->query('SELECT COUNT(*) FROM products WHERE stock <= 10')->fetchColumn();
    $todaySales = (int)$pdo->query("SELECT COUNT(*) FROM sales WHERE DATE(created_at)=CURDATE()")->fetchColumn();
    $totalRevenue = (float)$pdo->query('SELECT COALESCE(SUM(total),0) FROM sales')->fetchColumn();
    $recent = $pdo->query('SELECT * FROM sales ORDER BY id DESC LIMIT 10')->fetchAll();
    foreach ($recent as &$r) {
        $items = $pdo->prepare('SELECT si.id, si.quantity, si.price, si.subtotal, p.id AS product_id, p.name, p.sku FROM sale_items si JOIN products p ON si.product_id=p.id WHERE si.sale_id=?');
        $items->execute([$r['id']]);
        $r['items'] = array_map(fn($i) => [
            'id' => (int)$i['id'],
            'quantity' => (int)$i['quantity'],
            'price' => $i['price'],
            'subtotal' => $i['subtotal'],
            'product' => ['id' => (int)$i['product_id'], 'name' => $i['name'], 'sku' => $i['sku']],
        ], $items->fetchAll());
    }
    respond([
        'totalProducts' => $totalProducts,
        'totalCategories' => $totalCategories,
        'totalSales' => $totalSales,
        'lowStockProducts' => $lowStock,
        'todaySales' => $todaySales,
        'totalRevenue' => $totalRevenue,
        'recentSales' => $recent,
    ]);
}

// Suppliers
if ($method === 'GET' && $path === '/api/admin/suppliers') {
    require_auth(['OWNER', 'MANAGER']);
    $rows = $pdo->query('SELECT * FROM suppliers ORDER BY name ASC')->fetchAll();
    respond($rows);
}

if ($method === 'GET' && preg_match('#^/api/admin/suppliers/(\d+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $stmt = $pdo->prepare('SELECT * FROM suppliers WHERE id = ?');
    $stmt->execute([(int)$m[1]]);
    $row = $stmt->fetch();
    if (!$row) not_found();
    respond($row);
}

if ($method === 'POST' && $path === '/api/admin/suppliers') {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $name = trim($data['name'] ?? '');
    if (!$name) respond(['error' => 'Supplier name required'], 400);
    $stmt = $pdo->prepare('INSERT INTO suppliers (name, contact_name, phone, email, address, terms) VALUES (?,?,?,?,?,?)');
    $stmt->execute([
        $name,
        $data['contactName'] ?? null,
        $data['phone'] ?? null,
        $data['email'] ?? null,
        $data['address'] ?? null,
        $data['terms'] ?? null,
    ]);
    $supplierId = (int)$pdo->lastInsertId();
    log_action($pdo, (int)$me['id'], 'supplier.created', ['supplierId' => $supplierId]);
    respond(['id' => $supplierId]);
}

if ($method === 'PUT' && preg_match('#^/api/admin/suppliers/(\d+)$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $id = (int)$m[1];
    $stmt = $pdo->prepare('UPDATE suppliers SET name = ?, contact_name = ?, phone = ?, email = ?, address = ?, terms = ? WHERE id = ?');
    $stmt->execute([
        $data['name'] ?? '',
        $data['contactName'] ?? null,
        $data['phone'] ?? null,
        $data['email'] ?? null,
        $data['address'] ?? null,
        $data['terms'] ?? null,
        $id,
    ]);
    log_action($pdo, (int)$me['id'], 'supplier.updated', ['supplierId' => $id]);
    respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/api/admin/suppliers/(\d+)$#', $path, $m)) {
    require_auth(['OWNER']);
    $pdo->prepare('DELETE FROM suppliers WHERE id = ?')->execute([(int)$m[1]]);
    respond(['ok' => true]);
}

// Purchase orders
if ($method === 'GET' && $path === '/api/admin/purchase-orders') {
    require_auth(['OWNER', 'MANAGER']);
    $stmt = $pdo->query('SELECT po.*, s.name AS supplier_name, u.name AS created_by_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id LEFT JOIN users u ON po.created_by = u.id ORDER BY po.id DESC');
    $rows = $stmt->fetchAll();
    respond($rows);
}

if ($method === 'GET' && preg_match('#^/api/admin/purchase-orders/(\d+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[1];
    $orderStmt = $pdo->prepare('SELECT po.*, s.name AS supplier_name, u.name AS created_by_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.id LEFT JOIN users u ON po.created_by = u.id WHERE po.id = ?');
    $orderStmt->execute([$id]);
    $order = $orderStmt->fetch();
    if (!$order) not_found();
    $itemsStmt = $pdo->prepare('SELECT poi.*, p.name AS product_name, p.sku FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id WHERE poi.purchase_order_id = ?');
    $itemsStmt->execute([$id]);
    $order['items'] = $itemsStmt->fetchAll();
    respond($order);
}

if ($method === 'POST' && $path === '/api/admin/purchase-orders') {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $supplierId = (int)($data['supplierId'] ?? 0);
    $items = $data['items'] ?? [];
    if ($supplierId <= 0 || !$items) respond(['error' => 'Supplier and items required'], 400);
    $status = strtoupper($data['status'] ?? 'ORDERED');
    if (!in_array($status, ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'], true)) {
        respond(['error' => 'Invalid status'], 400);
    }
    $pdo->beginTransaction();
    try {
        $orderedAt = ($status === 'DRAFT') ? null : date('Y-m-d H:i:s');
        $stmt = $pdo->prepare('INSERT INTO purchase_orders (supplier_id, status, ordered_at, created_by, notes) VALUES (?,?,?,?,?)');
        $stmt->execute([$supplierId, $status, $orderedAt, $me['id'], $data['notes'] ?? null]);
        $orderId = (int)$pdo->lastInsertId();
        $itemStmt = $pdo->prepare('INSERT INTO purchase_order_items (purchase_order_id, product_id, ordered_qty, received_qty, cost_price) VALUES (?,?,?,?,?)');
        foreach ($items as $line) {
            $productId = (int)($line['productId'] ?? 0);
            $qty = (int)($line['quantity'] ?? 0);
            $cost = (float)($line['costPrice'] ?? 0);
            if ($productId <= 0 || $qty <= 0 || $cost <= 0) {
                throw new Exception('Invalid purchase order item');
            }
            $itemStmt->execute([$orderId, $productId, $qty, 0, $cost]);
        }
        $pdo->commit();
        log_action($pdo, (int)$me['id'], 'purchaseOrder.created', ['purchaseOrderId' => $orderId]);
        respond(['id' => $orderId]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(['error' => $e->getMessage()], 400);
    }
}

if ($method === 'PUT' && preg_match('#^/api/admin/purchase-orders/(\d+)$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $id = (int)$m[1];
    $status = strtoupper($data['status'] ?? 'ORDERED');
    if (!in_array($status, ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'], true)) {
        respond(['error' => 'Invalid status'], 400);
    }
    $currentStmt = $pdo->prepare('SELECT ordered_at FROM purchase_orders WHERE id = ?');
    $currentStmt->execute([$id]);
    $current = $currentStmt->fetch();
    if (!$current) not_found();
    $orderedAt = $current['ordered_at'];
    if ($status === 'DRAFT') {
        $orderedAt = null;
    } elseif (!$orderedAt) {
        $orderedAt = date('Y-m-d H:i:s');
    }
    $stmt = $pdo->prepare('UPDATE purchase_orders SET status = ?, ordered_at = ?, notes = ? WHERE id = ?');
    $stmt->execute([$status, $orderedAt, $data['notes'] ?? null, $id]);
    log_action($pdo, (int)$me['id'], 'purchaseOrder.updated', ['purchaseOrderId' => $id, 'status' => $status]);
    respond(['ok' => true]);
}

if ($method === 'POST' && preg_match('#^/api/admin/purchase-orders/(\d+)/receive$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[1];
    $data = json_input();
    $items = $data['items'] ?? [];
    if (!$items) respond(['error' => 'No items to receive'], 400);
    $pdo->beginTransaction();
    try {
        $poStmt = $pdo->prepare('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE');
        $poStmt->execute([$id]);
        $poRow = $poStmt->fetch();
        if (!$poRow) {
            throw new Exception('Purchase order not found');
        }
        foreach ($items as $line) {
            $itemId = (int)($line['itemId'] ?? 0);
            $receivedQty = max(0, (int)($line['receivedQty'] ?? 0));
            $costPrice = isset($line['costPrice']) ? (float)$line['costPrice'] : null;
            $stmt = $pdo->prepare('SELECT poi.*, p.id AS product_id FROM purchase_order_items poi JOIN products p ON poi.product_id = p.id WHERE poi.id = ? AND poi.purchase_order_id = ? FOR UPDATE');
            $stmt->execute([$itemId, $id]);
            $itemRow = $stmt->fetch();
            if (!$itemRow) throw new Exception('Purchase order item not found');
            $remaining = max(0, (int)$itemRow['ordered_qty'] - (int)$itemRow['received_qty']);
            $applyQty = min($receivedQty, $remaining);
            if ($applyQty <= 0) continue;
            $pdo->prepare('UPDATE purchase_order_items SET received_qty = received_qty + ?, cost_price = ? WHERE id = ?')
                ->execute([$applyQty, $costPrice ?? $itemRow['cost_price'], $itemId]);
            $productUpdate = $pdo->prepare('UPDATE products SET stock = stock + ?, cost_price = ? WHERE id = ?');
            $productUpdate->execute([
                $applyQty,
                $costPrice ?? $itemRow['cost_price'],
                $itemRow['product_id'],
            ]);
        }

        $pendingStmt = $pdo->prepare('SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = ? AND received_qty < ordered_qty');
        $pendingStmt->execute([$id]);
        $hasPending = (int)$pendingStmt->fetchColumn() > 0;
        if ($hasPending) {
            $pdo->prepare('UPDATE purchase_orders SET status = "ORDERED" WHERE id = ?')->execute([$id]);
        } else {
            $pdo->prepare('UPDATE purchase_orders SET status = "RECEIVED", received_at = NOW() WHERE id = ?')->execute([$id]);
        }

        $pdo->commit();
        log_action($pdo, (int)$me['id'], 'purchaseOrder.received', ['purchaseOrderId' => $id]);
        respond(['ok' => true]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(['error' => $e->getMessage()], 400);
    }
}

// Promotions
if ($method === 'GET' && $path === '/api/promotions') {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $activeOnly = isset($_GET['activeOnly']) ? filter_var($_GET['activeOnly'], FILTER_VALIDATE_BOOLEAN) : false;
    $query = 'SELECT pr.*, c.name AS category_name FROM promotions pr LEFT JOIN categories c ON pr.category_id = c.id';
    if ($activeOnly) {
        $query .= ' WHERE pr.active = 1 AND (pr.start_at IS NULL OR pr.start_at <= NOW()) AND (pr.end_at IS NULL OR pr.end_at >= NOW())';
    }
    $query .= ' ORDER BY pr.start_at DESC, pr.id DESC';
    $rows = $pdo->query($query)->fetchAll();
    respond($rows);
}

if ($method === 'POST' && $path === '/api/admin/promotions') {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $name = trim($data['name'] ?? '');
    $type = strtoupper($data['discountType'] ?? 'PERCENT');
    $value = (float)($data['discountValue'] ?? 0);
    if (!$name || !in_array($type, ['PERCENT', 'AMOUNT'], true) || $value <= 0) {
        respond(['error' => 'Invalid promotion'], 400);
    }
    $stmt = $pdo->prepare('INSERT INTO promotions (name, discount_type, discount_value, start_at, end_at, category_id, active) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([
        $name,
        $type,
        $value,
        $data['startAt'] ?? null,
        $data['endAt'] ?? null,
        $data['categoryId'] ?? null,
        !empty($data['active']) ? 1 : 0,
    ]);
    $promoId = (int)$pdo->lastInsertId();
    log_action($pdo, (int)$me['id'], 'promotion.created', ['promotionId' => $promoId]);
    respond(['id' => $promoId]);
}

if ($method === 'PUT' && preg_match('#^/api/admin/promotions/(\d+)$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $id = (int)$m[1];
    $type = strtoupper($data['discountType'] ?? 'PERCENT');
    $value = (float)($data['discountValue'] ?? 0);
    if (!in_array($type, ['PERCENT', 'AMOUNT'], true) || $value <= 0) {
        respond(['error' => 'Invalid promotion data'], 400);
    }
    $stmt = $pdo->prepare('UPDATE promotions SET name = ?, discount_type = ?, discount_value = ?, start_at = ?, end_at = ?, category_id = ?, active = ? WHERE id = ?');
    $stmt->execute([
        $data['name'] ?? '',
        $type,
        $value,
        $data['startAt'] ?? null,
        $data['endAt'] ?? null,
        $data['categoryId'] ?? null,
        !empty($data['active']) ? 1 : 0,
        $id,
    ]);
    log_action($pdo, (int)$me['id'], 'promotion.updated', ['promotionId' => $id]);
    respond(['ok' => true]);
}

if ($method === 'PATCH' && preg_match('#^/api/admin/promotions/(\d+)/toggle$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[1];
    $stmt = $pdo->prepare('UPDATE promotions SET active = 1 - active WHERE id = ?');
    $stmt->execute([$id]);
    log_action($pdo, (int)$me['id'], 'promotion.toggled', ['promotionId' => $id]);
    respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/api/admin/promotions/(\d+)$#', $path, $m)) {
    require_auth(['OWNER']);
    $pdo->prepare('DELETE FROM promotions WHERE id = ?')->execute([(int)$m[1]]);
    respond(['ok' => true]);
}

// Customers
if ($method === 'GET' && preg_match('#^/api/(admin/)?customers/?$#', $path)) {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;
    $total = (int)$pdo->query('SELECT COUNT(*) FROM customer_profiles')->fetchColumn();
    $stmt = $pdo->prepare('SELECT * FROM customer_profiles ORDER BY created_at DESC LIMIT ? OFFSET ?');
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->bindValue(2, $offset, PDO::PARAM_INT);
    $stmt->execute();
    respond([
        'customers' => $stmt->fetchAll(),
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'totalPages' => max(1, (int)ceil($total / $limit)),
        ],
    ]);
}

if ($method === 'GET' && preg_match('#^/api/(admin/)?customers/search/?$#', $path)) {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $q = trim($_GET['q'] ?? '');
    if ($q === '') respond([]);
    $stmt = $pdo->prepare('SELECT * FROM customer_profiles WHERE name LIKE ? OR phone LIKE ? ORDER BY created_at DESC LIMIT 20');
    $like = '%' . $q . '%';
    $stmt->execute([$like, $like]);
    respond($stmt->fetchAll());
}

if ($method === 'GET' && preg_match('#^/api/(admin/)?customers/(\d+)/?$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $stmt = $pdo->prepare('SELECT * FROM customer_profiles WHERE id = ?');
    $stmt->execute([(int)$m[2]]);
    $row = $stmt->fetch();
    if (!$row) not_found();
    respond($row);
}

if ($method === 'GET' && preg_match('#^/api/(admin/)?customers/(\d+)/purchases/?$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $stmt = $pdo->prepare('SELECT s.*, cpr.id AS link_id FROM customer_purchases cpr JOIN sales s ON cpr.sale_id = s.id WHERE cpr.customer_id = ? ORDER BY s.id DESC');
    $stmt->execute([(int)$m[2]]);
    respond($stmt->fetchAll());
}

if ($method === 'POST' && preg_match('#^/api/(admin/)?customers/?$#', $path)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $name = trim($data['name'] ?? '');
    if (!$name) respond(['error' => 'Customer name required'], 400);
    $stmt = $pdo->prepare('INSERT INTO customer_profiles (name, phone, loyalty_points) VALUES (?,?,?)');
    $stmt->execute([
        $name,
        $data['phone'] ?? null,
        (int)($data['loyaltyPoints'] ?? 0),
    ]);
    $custId = (int)$pdo->lastInsertId();
    log_action($pdo, (int)$me['id'], 'customer.created', ['customerId' => $custId]);
    respond(['id' => $custId]);
}

if ($method === 'PUT' && preg_match('#^/api/(admin/)?customers/(\d+)/?$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[2];
    $data = json_input();
    $stmt = $pdo->prepare('UPDATE customer_profiles SET name = ?, phone = ?, loyalty_points = ? WHERE id = ?');
    $stmt->execute([
        $data['name'] ?? '',
        $data['phone'] ?? null,
        (int)($data['loyaltyPoints'] ?? 0),
        $id,
    ]);
    log_action($pdo, (int)$me['id'], 'customer.updated', ['customerId' => $id]);
    respond(['ok' => true]);
}

// Sales detail helpers
if ($method === 'GET' && preg_match('#^/api/sales/(\d+)$#', $path, $m)) {
    require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[1];
    $stmt = $pdo->prepare('SELECT * FROM sales WHERE id = ?');
    $stmt->execute([$id]);
    $sale = $stmt->fetch();
    if (!$sale) not_found();
    $itemsStmt = $pdo->prepare('SELECT si.*, p.name, p.sku FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = ?');
    $itemsStmt->execute([$id]);
    $sale['items'] = $itemsStmt->fetchAll();
    $paymentsStmt = $pdo->prepare('SELECT method, amount, reference FROM payment_records WHERE sale_id = ?');
    $paymentsStmt->execute([$id]);
    $sale['payments'] = $paymentsStmt->fetchAll();
    $receiptStmt = $pdo->prepare('SELECT email, phone, gift_receipt, receipt_url FROM receipts WHERE sale_id = ?');
    $receiptStmt->execute([$id]);
    $sale['receipt'] = $receiptStmt->fetch();
    respond($sale);
}

// Refunds
if ($method === 'GET' && $path === '/api/admin/refunds') {
    require_auth(['OWNER', 'MANAGER']);
    $rows = $pdo->query('SELECT r.*, s.receipt_number, u.name AS processed_by_name, au.name AS approved_by_name FROM refunds r JOIN sales s ON r.sale_id = s.id JOIN users u ON r.processed_by = u.id LEFT JOIN users au ON r.approved_by = au.id ORDER BY r.id DESC')->fetchAll();
    respond($rows);
}

if ($method === 'POST' && $path === '/api/admin/refunds') {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $saleId = (int)($data['saleId'] ?? 0);
    $items = $data['items'] ?? [];
    if ($saleId <= 0 || !$items) respond(['error' => 'Sale and items required'], 400);
    $saleStmt = $pdo->prepare('SELECT * FROM sales WHERE id = ? FOR UPDATE');
    $saleStmt->execute([$saleId]);
    $sale = $saleStmt->fetch();
    if (!$sale) respond(['error' => 'Sale not found'], 404);
    $approvalId = null;
    if (!empty($data['approvedBy'])) {
        $approvalId = (int)$data['approvedBy'];
    } elseif ($me['role'] === 'OWNER') {
        $approvalId = (int)$me['id'];
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO refunds (sale_id, processed_by, approved_by, reason) VALUES (?,?,?,?)');
        $stmt->execute([$saleId, $me['id'], $approvalId, $data['reason'] ?? null]);
        $refundId = (int)$pdo->lastInsertId();

        $totalRefund = 0.0;
        foreach ($items as $line) {
            $saleItemId = (int)($line['saleItemId'] ?? 0);
            $qty = max(0, (int)($line['quantity'] ?? 0));
            $amount = (float)($line['amount'] ?? 0);
            $restock = !empty($line['restock']);
            if ($saleItemId <= 0 || $qty <= 0 || $amount <= 0) {
                throw new Exception('Invalid refund item');
            }
            $itemStmt = $pdo->prepare('SELECT * FROM sale_items WHERE id = ? FOR UPDATE');
            $itemStmt->execute([$saleItemId]);
            $itemRow = $itemStmt->fetch();
            if (!$itemRow) {
                throw new Exception('Sale item not found');
            }
            $refundedStmt = $pdo->prepare('SELECT COALESCE(SUM(quantity),0) FROM refund_items WHERE sale_item_id = ?');
            $refundedStmt->execute([$saleItemId]);
            $alreadyRefunded = (int)$refundedStmt->fetchColumn();
            if ($qty > ((int)$itemRow['quantity'] - $alreadyRefunded)) {
                throw new Exception('Refund quantity exceeds original sale quantity');
            }
            $totalRefund += $amount;
            $pdo->prepare('INSERT INTO refund_items (refund_id, sale_item_id, quantity, amount, restocked) VALUES (?,?,?,?,?)')
                ->execute([$refundId, $saleItemId, $qty, $amount, $restock ? 1 : 0]);
            if ($restock) {
                $pdo->prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
                    ->execute([$qty, $itemRow['product_id']]);
            }
        }

        // adjust register cash for cash refunds
        $registerId = (int)$sale['register_id'];
        if ($registerId) {
            $paymentStmt = $pdo->prepare('SELECT method, amount FROM payment_records WHERE sale_id = ?');
            $paymentStmt->execute([$saleId]);
            $cashPaid = 0.0;
            foreach ($paymentStmt->fetchAll() as $pay) {
                if ($pay['method'] === 'CASH') {
                    $cashPaid += (float)$pay['amount'];
                }
            }
            $cashRefund = min($totalRefund, $cashPaid);
            if ($cashRefund > 0) {
                $pdo->prepare('UPDATE registers SET current_cash = current_cash - ? WHERE id = ?')
                    ->execute([$cashRefund, $registerId]);
            }
        }

        $pdo->commit();
        log_action($pdo, (int)$me['id'], 'refund.created', ['refundId' => $refundId, 'saleId' => $saleId, 'amount' => $totalRefund]);
        respond(['id' => $refundId, 'refundedAmount' => $totalRefund]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        respond(['error' => $e->getMessage()], 400);
    }
}

// Audit logs
if ($method === 'GET' && $path === '/api/admin/audit-logs') {
    require_auth(['OWNER']);
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;
    $total = (int)$pdo->query('SELECT COUNT(*) FROM audit_logs')->fetchColumn();
    $stmt = $pdo->prepare('SELECT al.*, u.name AS user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.id DESC LIMIT ? OFFSET ?');
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->bindValue(2, $offset, PDO::PARAM_INT);
    $stmt->execute();
    respond([
        'logs' => $stmt->fetchAll(),
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'totalPages' => max(1, (int)ceil($total / $limit)),
        ],
    ]);
}

// Hold bill
if ($method === 'POST' && $path === '/api/pos/bills/hold') {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $data = json_input();
    $items = $data['items'] ?? [];
    $notes = $data['notes'] ?? null;
    if (!$items) respond(['error' => 'No items'], 400);
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO held_bills (notes) VALUES (?)')->execute([$notes]);
    $billId = $pdo->lastInsertId();
    $stmt = $pdo->prepare('INSERT INTO held_bill_items (bill_id, product_id, quantity) VALUES (?,?,?)');
    foreach ($items as $it) {
        $stmt->execute([$billId, (int)$it['productId'], (int)$it['quantity']]);
    }
    $pdo->commit();
    respond(['ok' => true]);
}

// Promotions
if ($method === 'GET' && preg_match('#^/api/(admin/)?promotions/?$#', $path)) {
    require_auth(['OWNER', 'MANAGER', 'CASHIER']);
    $activeOnly = isset($_GET['activeOnly']) ? filter_var($_GET['activeOnly'], FILTER_VALIDATE_BOOLEAN) : false;
    $query = 'SELECT pr.*, c.name AS category_name FROM promotions pr LEFT JOIN categories c ON pr.category_id = c.id';
    if ($activeOnly) {
        $query .= ' WHERE pr.active = 1 AND (pr.start_at IS NULL OR pr.start_at <= NOW()) AND (pr.end_at IS NULL OR pr.end_at >= NOW())';
    }
    $query .= ' ORDER BY pr.start_at DESC, pr.id DESC';
    $rows = $pdo->query($query)->fetchAll();
    
    $out = array_map(function($r) {
        return [
            'id' => (int)$r['id'],
            'name' => $r['name'],
            'discountType' => $r['discount_type'],
            'discountValue' => (float)$r['discount_value'],
            'startAt' => $r['start_at'],
            'endAt' => $r['end_at'],
            'categoryId' => $r['category_id'] ? (int)$r['category_id'] : null,
            'categoryName' => $r['category_name'] ?? 'All Categories',
            'active' => (bool)$r['active'],
            'createdAt' => $r['created_at']
        ];
    }, $rows);
    
    respond($out);
}

if ($method === 'POST' && preg_match('#^/api/admin/promotions/?$#', $path)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $data = json_input();
    $name = trim($data['name'] ?? '');
    $type = strtoupper($data['discountType'] ?? 'PERCENT');
    $value = (float)($data['discountValue'] ?? 0);
    if (!$name || !in_array($type, ['PERCENT', 'AMOUNT'], true) || $value <= 0) {
        respond(['error' => 'Invalid promotion'], 400);
    }
    $stmt = $pdo->prepare('INSERT INTO promotions (name, discount_type, discount_value, start_at, end_at, category_id, active) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([
        $name,
        $type,
        $value,
        $data['startAt'] ?? null,
        $data['endAt'] ?? null,
        $data['categoryId'] ?? null,
        !empty($data['active']) ? 1 : 0,
    ]);
    $promoId = (int)$pdo->lastInsertId();
    log_action($pdo, (int)$me['id'], 'promotion.created', ['promotionId' => $promoId]);
    respond(['id' => $promoId]);
}

if ($method === 'PUT' && preg_match('#^/api/admin/promotions/(\d+)$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[1];
    $data = json_input();
    $type = strtoupper($data['discountType'] ?? 'PERCENT');
    $value = (float)($data['discountValue'] ?? 0);
    if (!in_array($type, ['PERCENT', 'AMOUNT'], true) || $value <= 0) {
        respond(['error' => 'Invalid promotion data'], 400);
    }
    $stmt = $pdo->prepare('UPDATE promotions SET name = ?, discount_type = ?, discount_value = ?, start_at = ?, end_at = ?, category_id = ?, active = ? WHERE id = ?');
    $stmt->execute([
        $data['name'] ?? '',
        $type,
        $value,
        $data['startAt'] ?? null,
        $data['endAt'] ?? null,
        $data['categoryId'] ?? null,
        !empty($data['active']) ? 1 : 0,
        $id,
    ]);
    log_action($pdo, (int)$me['id'], 'promotion.updated', ['promotionId' => $id]);
    respond(['ok' => true]);
}

if ($method === 'PATCH' && preg_match('#^/api/admin/promotions/(\d+)/toggle$#', $path, $m)) {
    $me = require_auth(['OWNER', 'MANAGER']);
    $id = (int)$m[1];
    $stmt = $pdo->prepare('UPDATE promotions SET active = 1 - active WHERE id = ?');
    $stmt->execute([$id]);
    log_action($pdo, (int)$me['id'], 'promotion.toggled', ['promotionId' => $id]);
    respond(['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/api/admin/promotions/(\d+)$#', $path, $m)) {
    require_auth(['OWNER']);
    $pdo->prepare('DELETE FROM promotions WHERE id = ?')->execute([(int)$m[1]]);
    respond(['ok' => true]);
}

not_found();
