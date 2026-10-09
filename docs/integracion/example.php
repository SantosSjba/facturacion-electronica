<?php
// PHP 8 + cURL. No request is made until this example is explicitly run.
$base = rtrim(getenv('FACTOSYS_URL') ?: 'http://localhost:3000', '/');
$key = getenv('FACTOSYS_API_KEY') ?: throw new RuntimeException('Set FACTOSYS_API_KEY');
function callApi(string $method, string $path, ?array $body = null, ?string $idem = null): array {
    global $base, $key;
    $ch = curl_init($base . $path);
    $headers = ['Authorization: Bearer ' . $key, 'Accept: application/json'];
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    if ($idem !== null) $headers[] = 'Idempotency-Key: ' . $idem;
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
    $raw = curl_exec($ch);
    if ($raw === false) throw new RuntimeException('Transport failure; reconcile using the original idempotency key');
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    $json = $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if ($status >= 400) throw new RuntimeException(json_encode($json));
    return $json;
}
$body = json_decode(file_get_contents($argv[1] ?? 'cases/01-01-credito-cuotas.json'), true, 512, JSON_THROW_ON_ERROR);
$body['company_id'] = getenv('FACTOSYS_COMPANY_ID') ?: $body['company_id'];
$idem = getenv('FACTOSYS_IDEMPOTENCY_KEY') ?: throw new RuntimeException('Persist FACTOSYS_IDEMPOTENCY_KEY before submission');
$doc = callApi('POST', '/v1/invoices', $body, $idem);
for ($i = 0; $i < 30 && !in_array($doc['status'], ['accepted','accepted_with_observation','rejected','failed','cancelled'], true); $i++) {
    sleep(2); $doc = callApi('GET', '/v1/documents/' . rawurlencode($doc['id']));
}
echo json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), PHP_EOL;
// 201 is local registration. Deliver with POST /deliveries only after acceptance.
