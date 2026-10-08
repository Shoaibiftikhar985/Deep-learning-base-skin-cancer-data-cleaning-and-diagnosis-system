<?php
session_start();
require_once 'db_connect.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$rawInput = file_get_contents('php://input');
$jsonData = json_decode($rawInput, true) ?? [];

$user_id = $_SESSION['user_id'] ?? $jsonData['user_id'] ?? null;
$email   = $_SESSION['user_email'] ?? $jsonData['email'] ?? 'anonymous@dermanova.ai';
$rating  = trim($_POST['rating'] ?? $jsonData['rating'] ?? ''); // 'up' or 'down'
$message = trim($_POST['message_text'] ?? $jsonData['message_text'] ?? '');
$chat_title = trim($_POST['chat_title'] ?? $jsonData['chat_title'] ?? '');

if (empty($rating)) {
    echo json_encode(['success' => false, 'message' => 'Rating required.']);
    exit;
}

// Ensure user_feedback table exists
$sql = "CREATE TABLE IF NOT EXISTS user_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    email VARCHAR(150) NULL,
    chat_title VARCHAR(255) NULL,
    rating VARCHAR(10) NOT NULL,
    message_text TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8";

$conn->query($sql);

$stmt = $conn->prepare("INSERT INTO user_feedback (user_id, email, chat_title, rating, message_text) VALUES (?, ?, ?, ?, ?)");
if ($stmt) {
    $stmt->bind_param("issss", $user_id, $email, $chat_title, $rating, $message);
    $stmt->execute();
    $stmt->close();
}

$conn->close();

echo json_encode([
    'success' => true,
    'message' => 'Feedback saved! Your input directly helps train and fine-tune DermaNova AI models.'
]);
?>
