<?php
session_start();
require_once 'db_connect.php';

// Set JSON response header
header('Content-Type: application/json');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

// Determine action or handle Google Auth
$action = $_POST['action'] ?? 'signup';

if ($action === 'google_auth') {
    $email = trim($_POST['email'] ?? '');
    $full_name = trim($_POST['full_name'] ?? 'Google User');
    
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address provided for Google Sign-In.']);
        exit;
    }
    
    // Check if user already exists
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
    
    // User does not exist yet — auto-register as Google user
    $random_pw = 'GoogleAuth_' . bin2hex(random_bytes(6));
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $full_name, $email, $random_pw);
    
    if ($stmt->execute()) {
        $new_user_id = $conn->insert_id;
        $_SESSION['user_id']    = $new_user_id;
        $_SESSION['user_name']  = $full_name;
        $_SESSION['user_email'] = $email;
        $stmt->close();
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
        echo json_encode(['success' => false, 'message' => 'Failed to create account with Google.']);
        exit;
    }
}

// Get and sanitize inputs
$full_name = trim($_POST['full_name'] ?? '');
$email     = trim($_POST['email'] ?? '');
$password  = $_POST['password'] ?? '';

// Basic validation
if (empty($full_name) || empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}

// Password validation: First letter capital, min 8 chars, letters, numbers, and symbols mix
$passwordRegex = '/^[A-Z](?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"\'<>,.?\/~` \-]).{7,}$/';

if (!preg_match($passwordRegex, $password)) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters, start with a Capital letter, and contain a mix of letters, numbers, and symbols.']);
    exit;
}

// Check if email already exists
$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    exit;
}
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    $stmt->close();
    echo json_encode(['success' => false, 'message' => 'This email is already registered. Please login.']);
    exit;
}
$stmt->close();

// Insert new user into database with plaintext password as requested
$stmt = $conn->prepare("INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)");
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    exit;
}
$stmt->bind_param("sss", $full_name, $email, $password);

if ($stmt->execute()) {
    $new_user_id = $conn->insert_id;

    // Set session after successful registration
    $_SESSION['user_id']   = $new_user_id;
    $_SESSION['user_name'] = $full_name;
    $_SESSION['user_email']= $email;

    $stmt->close();
    $conn->close();

    echo json_encode([
        'success'  => true,
        'message'  => 'Account created successfully!',
        'redirect' => 'index.html',
        'user'     => ['name' => $full_name, 'email' => $email]
    ]);
} else {
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
}
?>
