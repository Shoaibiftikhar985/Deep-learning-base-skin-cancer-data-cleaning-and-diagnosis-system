<?php
// ============================================================
//  DermaNova AI — AI Proxy (Groq / OpenAI compatible)
//  Receives {messages:[...]} JSON from the browser,
//  forwards to Groq API, returns assistant reply as JSON.
//  The API key is NEVER sent to the client.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once 'openai_config.php';

// ── Validate request ───────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (!$data || !isset($data['messages']) || !is_array($data['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request body. Expected {messages:[...]}']);
    exit;
}

$messages = $data['messages'];

// ── Build Groq payload ────────────────────────────────
$payload = json_encode([
    'model'       => OPENAI_MODEL,
    'messages'    => $messages,
    'max_tokens'  => OPENAI_MAX_TOKENS,
    'temperature' => OPENAI_TEMPERATURE,
]);

// ── Call Groq API via cURL ───────────────────────────
$ch = curl_init(OPENAI_API_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . OPENAI_API_KEY,
    ],
    CURLOPT_SSL_VERIFYPEER => false,
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// ── Handle cURL errors ─────────────────────────────────────
if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Network error: ' . $curlError]);
    exit;
}

// ── Parse OpenAI response ─────────────────────────────────
$openaiData = json_decode($response, true);

if ($httpCode !== 200 || !isset($openaiData['choices'][0]['message']['content'])) {
    $errMsg = $openaiData['error']['message'] ?? 'Unknown Groq API error';
    http_response_code($httpCode ?: 500);
    echo json_encode(['error' => $errMsg]);
    exit;
}

// ── Return only the assistant message ─────────────────────
echo json_encode([
    'reply'       => $openaiData['choices'][0]['message']['content'],
    'model'       => $openaiData['model'] ?? OPENAI_MODEL,
    'finish_reason' => $openaiData['choices'][0]['finish_reason'] ?? 'stop',
    'usage'       => $openaiData['usage'] ?? null,
]);
