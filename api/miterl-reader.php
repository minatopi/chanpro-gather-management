<?php
header('Content-Type: application/json; charset=utf-8');

$key = $_SERVER['miterl_api'] ?? '';

if (!$key) {
    http_response_code(401);
    exit(json_encode(['error'=>'APIキーが必要です']));
}

$url = 'https://miterl.com/api/v1/monitors';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer '.$key,
        'Accept: application/json'
    ],
    CURLOPT_TIMEOUT => 20
]);

$response = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    exit(json_encode(['error'=>$error]));
}

http_response_code($code);
echo $response;
