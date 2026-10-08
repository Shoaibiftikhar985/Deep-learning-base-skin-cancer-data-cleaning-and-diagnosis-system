<?php
require 'db_connect.php';
$conn->query("ALTER TABLE users ADD COLUMN otp VARCHAR(10) NULL");
$conn->query("ALTER TABLE users ADD COLUMN otp_expiry DATETIME NULL");
echo "Done";
?>
