<?php
session_start();
require_once 'db_connect.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
    exit;
}

$user_id = $_SESSION['user_id'];
$new_name  = trim($_POST['name']  ?? '');
$new_email = trim($_POST['email'] ?? '');

if (empty($new_name) || empty($new_email)) {
    echo json_encode(['success' => false, 'message' => 'Name and email are required.']);
    exit;
}

if (!filter_var($new_email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}

// Check if email is taken by another user
$check = $conn->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
$check->bind_param("si", $new_email, $user_id);
$check->execute();
$check->store_result();
if ($check->num_rows > 0) {
    echo json_encode(['success' => false, 'message' => 'That email is already in use by another account.']);
    exit;
}
$check->close();

$stmt = $conn->prepare("UPDATE users SET full_name = ?, email = ? WHERE id = ?");
$stmt->bind_param("ssi", $new_name, $new_email, $user_id);

if ($stmt->execute()) {
    $_SESSION['full_name']  = $new_name;
    $_SESSION['email'] = $new_email;
    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully.',
        'user' => ['name' => $new_name, 'email' => $new_email]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update. Please try again.']);
}

$stmt->close();
$conn->close();
?>
