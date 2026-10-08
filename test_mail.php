<?php
// Quick diagnostic — delete this file after testing!
error_reporting(E_ALL);
ini_set('display_errors', 1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'Exception.php';
require 'PHPMailer.php';
require 'SMTP.php';

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'shoaibiftikhar985@gmail.com';
    $mail->Password   = 'hwte akue zgza rsit'; // app password (spaces are fine)
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->SMTPDebug  = 2; // Show full SMTP debug output

    $mail->setFrom('shoaibiftikhar985@gmail.com', 'DermaNova Test');
    $mail->addAddress('shoaibiftikhar985@gmail.com'); // Send to self as test

    $mail->isHTML(true);
    $mail->Subject = 'DermaNova Test Email';
    $mail->Body    = '<p>SMTP is working correctly!</p>';

    $mail->send();
    echo '<h2 style="color:green">✅ Email sent successfully! SMTP is working.</h2>';
} catch (Exception $e) {
    echo '<h2 style="color:red">❌ SMTP Error: ' . $mail->ErrorInfo . '</h2>';
    echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
}
?>
