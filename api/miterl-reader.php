
<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$api = getenv('miterl_api');

if (!$api) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'miterl_api が設定されていません'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$ch = curl_init($api);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => [
        'Accept: application/json'
    ]
]);

$response = curl_exec($ch);
$error = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error' => $error
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code($status ?: 502);
echo $response;
