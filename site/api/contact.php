<?php
/**
 * Formulario presupuesto - todo en un archivo (Dinahosting PHP 7.4+)
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$config = array(
    'to_email' => 'cvpalmanord@cvpalmanord.es',
    'from_email' => 'cvpalmanord@cvpalmanord.es',
    'from_name' => 'Clinica Veterinaria Palmanord',
    'subject_prefix' => '[Presupuesto web] ',
    'site_url' => 'https://cvpalmanord.es',
    'send_client_copy' => true
);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    json_out(true, null, 200);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(false, 'method_not_allowed', 405);
}

$raw = file_get_contents('php://input');
$data = null;
if ($raw !== false && $raw !== '') {
    $data = json_decode($raw, true);
}
if (!is_array($data) && !empty($_POST)) {
    $data = $_POST;
}
if (!is_array($data)) {
    json_out(false, 'invalid_json', 400);
}

if (!empty($data['website'])) {
    json_out(false, 'spam', 400);
}

$name = clean($data['name'] ?? $data['your-name'] ?? '', 120);
$email = clean($data['email'] ?? $data['your-email'] ?? '', 254);
$phone = clean($data['phone'] ?? $data['your-phone'] ?? '', 40);
$animalName = clean($data['animalName'] ?? $data['your-animal-name'] ?? '', 120);
$animalRace = clean($data['animalRace'] ?? $data['your-animal-race'] ?? '', 120);
$animalWeight = clean($data['animalWeight'] ?? $data['your-animal-weight'] ?? '', 40);
$message = clean($data['message'] ?? $data['your-message'] ?? '', 4000);
$marketing = !empty($data['marketing']);

if ($name === '' || $email === '' || $phone === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_out(false, 'missing_fields', 422);
}

$from = $config['from_email'];
$to = $config['to_email'];
$subject = $config['subject_prefix'] . $name;

$staffBody = "Nueva solicitud web\n\n"
    . "Nombre: $name\n"
    . "Email: $email\n"
    . "Telefono: $phone\n"
    . "Mascota: $animalName\n"
    . "Raza: $animalRace\n"
    . "Peso: $animalWeight\n"
    . "Mensaje: " . ($message !== '' ? $message : '(sin mensaje)') . "\n"
    . "Marketing: " . ($marketing ? 'Si' : 'No') . "\n";

$staffHeaders = "From: {$config['from_name']} <$from>\r\n"
    . "Reply-To: $email\r\n"
    . "Cc: $email\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n";

if (!send_mail($to, $subject, $staffBody, $staffHeaders, $from)) {
    json_out(false, 'mail_failed', 502);
}

if ($config['send_client_copy']) {
    $html = client_email_html($config, $name, $email, $phone, $animalName, $animalRace, $animalWeight, $message);
    $clientHeaders = "From: {$config['from_name']} <$from>\r\n"
        . "Reply-To: {$config['to_email']}\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n";
    send_mail($email, 'Gracias por contactar - Clinica Veterinaria Palmanord', $html, $clientHeaders, $from);
}

json_out(true, null, 200);

function json_out($ok, $error, $code)
{
    http_response_code($code);
    echo json_encode(array('ok' => (bool) $ok, 'error' => $error));
    exit;
}

function clean($v, $max)
{
    $v = is_string($v) ? trim($v) : '';
    if (strlen($v) > $max) {
        $v = substr($v, 0, $max);
    }
    return $v;
}

function send_mail($to, $subject, $body, $headers, $from)
{
    @ini_set('sendmail_from', $from);
    return @mail($to, $subject, $body, $headers, '-f' . $from);
}

function client_email_html($config, $name, $email, $phone, $animal, $race, $weight, $message)
{
    $logo = htmlspecialchars($config['site_url'] . '/wp-content/uploads/2021/11/logo_palmanord_blusa.png', ENT_QUOTES, 'UTF-8');
    $name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $phone = htmlspecialchars($phone, ENT_QUOTES, 'UTF-8');
    $animal = htmlspecialchars($animal, ENT_QUOTES, 'UTF-8');
    $race = htmlspecialchars($race, ENT_QUOTES, 'UTF-8');
    $weight = htmlspecialchars($weight, ENT_QUOTES, 'UTF-8');
    $msg = $message !== '' ? nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8')) : 'Sin mensaje adicional';
    $url = htmlspecialchars($config['site_url'], ENT_QUOTES, 'UTF-8');

    return '<!DOCTYPE html><html lang="es"><body style="font-family:Arial,sans-serif;background:#f7f9fb;color:#263246;padding:20px;">'
        . '<table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;"><tr><td style="background:#263246;padding:20px;text-align:center;">'
        . '<img src="' . $logo . '" alt="Palmanord" width="100" style="display:block;margin:0 auto 8px;"></td></tr>'
        . '<tr><td style="padding:24px;"><h1 style="margin:0 0 12px;font-size:22px;">Gracias, ' . $name . '</h1>'
        . '<p>Hemos recibido tu solicitud. <strong>Te contactaremos muy pronto</strong>.</p>'
        . '<p style="font-size:14px;color:#64748b;">Urgencias: <a href="tel:+34655214080">+34 655 214 080</a></p>'
        . '<hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;">'
        . '<p><strong>Resumen:</strong><br>Telefono: ' . $phone . '<br>Mascota: ' . $animal . ' (' . $race . ', ' . $weight . ')<br>' . $msg . '</p>'
        . '<p style="text-align:center;margin-top:20px;"><a href="' . $url . '" style="background:#d83a3a;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;">Visitar web</a></p>'
        . '</td></tr></table></body></html>';
}
