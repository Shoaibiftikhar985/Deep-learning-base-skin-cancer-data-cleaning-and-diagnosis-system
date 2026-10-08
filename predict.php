<?php
// ============================================================
//  DermaNova AI — Model Prediction Proxy (predict.php)
//  Receives an uploaded image from the browser and forwards it
//  to the Python model API (Flask, app.py) running on port 5000.
//  Returns the model's JSON verdict straight back to the browser.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Where the Python model API is running ───────────────────
define('MODEL_API_URL', 'http://127.0.0.1:5000/predict');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Validate the uploaded image ─────────────────────────────
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No image uploaded (field name must be "image")']);
    exit;
}

$tmpPath  = $_FILES['image']['tmp_name'];
$fileName = $_FILES['image']['name'] ?: 'lesion.jpg';
$mimeType = $_FILES['image']['type'] ?: 'application/octet-stream';

// ── Forward to the Python API as multipart/form-data ────────
$cfile = new CURLFile($tmpPath, $mimeType, $fileName);

$ch = curl_init(MODEL_API_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => ['image' => $cfile],
    CURLOPT_TIMEOUT        => 60,
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// ── Connection error → Python API not running ───────────────
if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Cannot reach model API — make sure the Python server (app.py) is running on port 5000. (' . $curlError . ')']);
    exit;
}

// ── Pass the model's JSON response straight back ────────────
http_response_code($httpCode ?: 200);
echo $response;
