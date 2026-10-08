<?php
error_reporting(0);
ini_set('display_errors', 0);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as MailerException;

require_once 'db_connect.php';
require_once 'Exception.php';
require_once 'PHPMailer.php';
require_once 'SMTP.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$email = trim($_POST['email'] ?? '');

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'Email is required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}

// Check if email exists in database
$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    exit;
}
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows === 0) {
    $stmt->close();
    echo json_encode(['success' => false, 'message' => 'No account found with this email.']);
    exit;
}
$stmt->close();

// Generate 6-digit OTP
$otp    = sprintf("%06d", mt_rand(100000, 999999));
$expiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));

// Save OTP to database
$stmt = $conn->prepare("UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?");
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $conn->error]);
    exit;
}
$stmt->bind_param("sss", $otp, $expiry, $email);
$stmt->execute();
$stmt->close();

// Send OTP via Gmail SMTP
$mail = new PHPMailer(true);

try {
    // SMTP settings
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'shoaibiftikhar985@gmail.com';
    $mail->Password   = 'hwte akue zgza rsit';     // Gmail App Password
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->Timeout    = 30;

    // Disable SSL verification (for localhost)
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
        ]
    ];

    // Sender & Recipient
    $mail->setFrom('shoaibiftikhar985@gmail.com', 'DermaNova AI');
    $mail->addAddress($email);

    // Email content
    $mail->isHTML(true);
    $mail->Subject = 'Your Password Reset OTP — DermaNova AI';
    $mail->Body    = "
        <div style='font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f5f8ff;border-radius:16px;'>
            <h2 style='color:#2266dc;margin-bottom:8px;'>DermaNova AI</h2>
            <h3 style='color:#1a2c3e;'>Password Reset Request</h3>
            <p style='color:#444;'>Use the OTP below to reset your password. It is valid for <strong>10 minutes</strong>.</p>
            <div style='background:#fff;border:2px solid #2266dc;border-radius:12px;padding:24px;text-align:center;margin:24px 0;'>
                <span style='font-size:36px;font-weight:700;letter-spacing:12px;color:#2266dc;'>{$otp}</span>
            </div>
            <p style='color:#888;font-size:13px;'>If you did not request this, please ignore this email. Do not share this OTP with anyone.</p>
        </div>
    ";
    $mail->AltBody = "Your DermaNova AI password reset OTP is: {$otp}. Valid for 10 minutes.";

    $mail->send();
    echo json_encode(['success' => true, 'message' => 'OTP sent successfully! Please check your email.']);

} catch (MailerException $e) {
    echo json_encode(['success' => false, 'message' => 'Failed to send email: ' . $mail->ErrorInfo]);
} catch (\Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Unexpected error: ' . $e->getMessage()]);
}
?>
