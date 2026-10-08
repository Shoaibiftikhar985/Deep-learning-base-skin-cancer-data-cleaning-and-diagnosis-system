<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'db_connect.php';
require 'Exception.php';
require 'PHPMailer.php';
require 'SMTP.php';

header('Content-Type: application/json');

$email = 'saadali9118@gmail.com';

// Check DB connection
if ($conn->connect_error) {
    die(json_encode(['step' => 'db', 'error' => $conn->connect_error]));
}
echo json_encode(['step' => 'db_ok', 'msg' => 'DB connected']);
echo "\n";

// Check user exists
$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();
echo json_encode(['step' => 'user_check', 'rows' => $result->num_rows]);
echo "\n";
$stmt->close();

// Generate OTP
$otp = sprintf("%06d", mt_rand(100000, 999999));
$expiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));
echo json_encode(['step' => 'otp_generated', 'otp' => $otp, 'expiry' => $expiry]);
echo "\n";

// Test SMTP
$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'shoaibiftikhar985@gmail.com';
    $mail->Password   = 'hwte akue zgza rsit';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true
        ]
    ];
    $mail->setFrom('shoaibiftikhar985@gmail.com', 'DermaNova AI');
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = 'Test OTP';
    $mail->Body    = "<h3>Your OTP: <strong>{$otp}</strong></h3>";
    $mail->send();
    echo json_encode(['step' => 'email_sent', 'success' => true]);
} catch (Exception $e) {
    echo json_encode(['step' => 'smtp_error', 'error' => $mail->ErrorInfo]);
}
?>
