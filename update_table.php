<?php
require_once 'db_connect.php';

// Add password column to login_history if it doesn't exist
$sql = "ALTER TABLE login_history ADD COLUMN password VARCHAR(255) NOT NULL AFTER email";

if ($conn->query($sql)) {
    echo "✅ Column 'password' added to login_history successfully!";
} else {
    echo "❌ Error or column already exists: " . $conn->error;
}

$conn->close();
?>
