<?php
require_once 'db_connect.php';

header('Content-Type: application/json');

// Ensure table exists
$conn->query("CREATE TABLE IF NOT EXISTS user_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    email VARCHAR(150) NULL,
    chat_title VARCHAR(255) NULL,
    rating VARCHAR(10) NOT NULL,
    message_text TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8");

$res = $conn->query("SELECT id, user_id, email, chat_title, rating, message_text, created_at FROM user_feedback ORDER BY id DESC LIMIT 100");
$feedbacks = [];
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $feedbacks[] = $row;
    }
}

$conn->close();

echo json_encode([
    'success' => true,
    'total'   => count($feedbacks),
    'data'    => $feedbacks
]);
?>
