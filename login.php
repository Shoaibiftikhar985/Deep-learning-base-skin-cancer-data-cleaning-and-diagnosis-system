<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();
session_start();
require_once 'db_connect.php';

// Set JSON response header
ob_clean();
header('Content-Type: application/json');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

// Determine action
$action = $_POST['action'] ?? 'login';

if ($action === 'google_auth') {
    $email = trim($_POST['email'] ?? '');
    $full_name = trim($_POST['full_name'] ?? 'Google User');
    
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address provided for Google Sign-In.']);
        exit;
    }
    
    // Check if user exists
    $stmt = $conn->prepare("SELECT id, full_name, email FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();
        $_SESSION['user_id']    = $user['id'];
        $_SESSION['user_name']  = $user['full_name'];
        $_SESSION['user_email'] = $user['email'];
        $stmt->close();
        
        // Log activity
        $log_stmt = $conn->prepare("INSERT INTO login_history (user_id, email, password) VALUES (?, ?, ?)");
        $g_pass = '[Google OAuth]';
        $log_stmt->bind_param("iss", $user['id'], $user['email'], $g_pass);
        $log_stmt->execute();
        $log_stmt->close();
        $conn->close();
        
        echo json_encode([
            'success'  => true,
            'message'  => 'Signed in with Google successfully!',
            'redirect' => 'index.html',
            'user'     => ['name' => $user['full_name'], 'email' => $user['email']]
        ]);
        exit;
    }
    $stmt->close();
    
    // Create new Google user
    $random_pw = 'GoogleAuth_' . bin2hex(random_bytes(6));
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $full_name, $email, $random_pw);
    
    if ($stmt->execute()) {
        $new_user_id = $conn->insert_id;
        $_SESSION['user_id']    = $new_user_id;
        $_SESSION['user_name']  = $full_name;
        $_SESSION['user_email'] = $email;
        $stmt->close();
        
        $log_stmt = $conn->prepare("INSERT INTO login_history (user_id, email, password) VALUES (?, ?, ?)");
        $g_pass = '[Google OAuth Signup]';
        $log_stmt->bind_param("iss", $new_user_id, $email, $g_pass);
        $log_stmt->execute();
        $log_stmt->close();
        $conn->close();
        
        echo json_encode([
            'success'  => true,
            'message'  => 'Account created with Google successfully!',
            'redirect' => 'index.html',
            'user'     => ['name' => $full_name, 'email' => $email]
        ]);
        exit;
    } else {
        $stmt->close();
        $conn->close();
        echo json_encode(['success' => false, 'message' => 'Failed to authenticate with Google.']);
        exit;
    }
}

// ── Step 2: Verify the OTP only (does NOT change the password or clear the OTP) ──
if ($action === 'verify_otp') {
    $email = trim($_POST['email'] ?? '');
    $otp   = trim($_POST['otp'] ?? '');

    if (empty($email) || empty($otp)) {
        echo json_encode(['success' => false, 'message' => 'Please enter the verification code.']);
        exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
        exit;
    }

    $stmt = $conn->prepare("SELECT otp, otp_expiry FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'No account found with this email.']);
        $stmt->close();
        exit;
    }
    $user = $result->fetch_assoc();
    $stmt->close();

    if (empty($user['otp']) || $user['otp'] !== $otp) {
        echo json_encode(['success' => false, 'message' => 'Invalid code. Please check and try again.']);
        exit;
    }
    if (strtotime($user['otp_expiry']) < time()) {
        echo json_encode(['success' => false, 'message' => 'This code has expired. Please request a new one.']);
        exit;
    }

    // OTP is valid — leave it in place so step 3 can re-verify before changing the password
    echo json_encode(['success' => true, 'message' => 'Code verified.']);
    exit;
}

if ($action === 'verify_otp_reset') {
    $email = trim($_POST['email'] ?? '');
    $otp = trim($_POST['otp'] ?? '');
    $newPassword = $_POST['new_password'] ?? '';

    if (empty($email) || empty($otp) || empty($newPassword)) {
        echo json_encode(['success' => false, 'message' => 'Please fill in all fields.']);
        exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
        exit;
    }

    // Password complexity validation
    if (strlen($newPassword) < 8 || !preg_match("/[A-Z]/", $newPassword) || !preg_match("/[0-9]/", $newPassword) || !preg_match("/[\W]/", $newPassword)) {
        echo json_encode(['success' => false, 'message' => 'Password must be 8+ chars with uppercase, number, and symbol.']);
        exit;
    }

    // Fetch user and verify OTP
    $stmt = $conn->prepare("SELECT otp, otp_expiry FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'No account found with this email.']);
        $stmt->close();
        exit;
    }
    $user = $result->fetch_assoc();
    $stmt->close();

    if (empty($user['otp']) || $user['otp'] !== $otp) {
        echo json_encode(['success' => false, 'message' => 'Invalid OTP.']);
        exit;
    }

    if (strtotime($user['otp_expiry']) < time()) {
        echo json_encode(['success' => false, 'message' => 'OTP has expired. Please request a new one.']);
        exit;
    }

    // Update password (securely hashed) and clear OTP
    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    $update_stmt = $conn->prepare("UPDATE users SET password = ?, otp = NULL, otp_expiry = NULL WHERE email = ?");
    $update_stmt->bind_param("ss", $hashed, $email);
    if ($update_stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Password reset successfully! You can now login.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update password.']);
    }
    $update_stmt->close();
    exit;
}

// Default login action
// Get inputs
$email    = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

// Basic validation
if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please fill in all fields.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}

// Fetch user from database by email
$stmt = $conn->prepare("SELECT id, full_name, email, password FROM users WHERE email = ?");
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    exit;
}
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'No account found with this email.']);
    exit;
}

$user = $result->fetch_assoc();
$stmt->close();

// Verify password — supports both bcrypt hashed and plaintext passwords
$passwordMatch = false;
if (strlen($user['password']) >= 60 && substr($user['password'], 0, 4) === '$2y$') {
    // Bcrypt hashed password
    $passwordMatch = password_verify($password, $user['password']);
} else {
    // Plaintext password (legacy)
    $passwordMatch = ($password === $user['password']);
}

if (!$passwordMatch) {
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'Incorrect password. Please try again.']);
    exit;
}

// Password correct — start session
$_SESSION['user_id']    = $user['id'];
$_SESSION['user_name']  = $user['full_name'];
$_SESSION['user_email'] = $user['email'];

// LOG LOGIN ACTIVITY: Save login info to login_history table
$log_stmt = $conn->prepare("INSERT INTO login_history (user_id, email, password) VALUES (?, ?, ?)");
$log_stmt->bind_param("iss", $user['id'], $user['email'], $password);
$log_stmt->execute();
$log_stmt->close();

$conn->close();

echo json_encode([
    'success'  => true,
    'message'  => 'Login successful!',
    'redirect' => 'index.html',
    'user'     => ['name' => $user['full_name'], 'email' => $user['email']]
]);
?>
