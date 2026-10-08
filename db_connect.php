<?php
// Database Configuration - XAMPP/phpMyAdmin
define('DB_HOST', '127.0.0.1');    // Use IP instead of localhost
define('DB_PORT', 3306);           // XAMPP MySQL actual port
define('DB_USER', 'root');         // XAMPP default user
define('DB_PASS', '');             // XAMPP default password (empty)
define('DB_NAME', 'oncodiag_db');  // Our database name

// Create connection with custom port
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);

// Check connection
if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $conn->connect_error
    ]));
}

// Set charset to utf8
$conn->set_charset("utf8");
?>
