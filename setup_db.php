<?php
/*
 * OncoDiag AI — Database Setup Script
 * Run this file ONCE in browser: http://localhost/FYP/setup_db.php
 * It will create the database and users table automatically.
 */

// Connect to MySQL WITHOUT selecting a database first
// Port 3306 is used because your XAMPP MySQL runs on 3306
$conn = new mysqli('127.0.0.1', 'root', '', '', 3306);

if ($conn->connect_error) {
    die("<h2 style='color:red'>❌ MySQL Connection Failed: " . $conn->connect_error . "</h2>
         <p>Make sure XAMPP Apache and MySQL are running!</p>");
}

// Create database if not exists
$sql = "CREATE DATABASE IF NOT EXISTS oncodiag_db CHARACTER SET utf8 COLLATE utf8_general_ci";
if ($conn->query($sql)) {
    echo "<p style='color:green'>✅ Database <strong>oncodiag_db</strong> created (or already exists).</p>";
} else {
    die("<p style='color:red'>❌ Failed to create database: " . $conn->error . "</p>");
}

// Select the database
$conn->select_db('oncodiag_db');

// Create users table
$sql = "CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    otp VARCHAR(10) NULL,
    otp_expiry DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8";

if ($conn->query($sql)) {
    echo "<p style='color:green'>✅ Table <strong>users</strong> created (or already exists).</p>";
} else {
    die("<p style='color:red'>❌ Failed to create table: " . $conn->error . "</p>");
}

// Create login_history table
$sql = "CREATE TABLE IF NOT EXISTS login_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8";

if ($conn->query($sql)) {
    echo "<p style='color:green'>✅ Table <strong>login_history</strong> created (or already exists).</p>";
} else {
    die("<p style='color:red'>❌ Failed to create login_history table: " . $conn->error . "</p>");
}

// Create user_feedback table
$sql = "CREATE TABLE IF NOT EXISTS user_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    email VARCHAR(150) NULL,
    chat_title VARCHAR(255) NULL,
    rating VARCHAR(10) NOT NULL,
    message_text TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8";

if ($conn->query($sql)) {
    echo "<p style='color:green'>✅ Table <strong>user_feedback</strong> created (or already exists).</p>";
} else {
    die("<p style='color:red'>❌ Failed to create user_feedback table: " . $conn->error . "</p>");
}

$conn->close();

echo "
<hr>
<h2 style='color:green'>✅ Database setup complete!</h2>
<p>You can now use <a href='signup.html'>Sign Up</a> and <a href='login.html'>Login</a>.</p>
<p style='color:orange'><strong>⚠️ IMPORTANT:</strong> Delete or restrict access to this file (setup_db.php) after setup!</p>
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
  hr { margin: 20px 0; }
</style>
";
?>
