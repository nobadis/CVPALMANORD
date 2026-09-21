<?php
/**
 * Expone CLARITY_PROJECT_ID al cliente (Dinahosting / PHP).
 * Sin la variable de entorno, projectId es null y Clarity no se carga.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$id = getenv('CLARITY_PROJECT_ID');
if (!is_string($id)) {
  $id = '';
}
$id = trim($id);

if ($id === '' || !preg_match('/^[A-Za-z0-9]+$/', $id)) {
  echo json_encode(array('projectId' => null));
  exit;
}

echo json_encode(array('projectId' => $id));
