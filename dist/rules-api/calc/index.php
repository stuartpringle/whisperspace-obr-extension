<?php

declare(strict_types=1);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-WS-API-Key");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function load_env(string $path): void {
  if (!file_exists($path)) return;
  $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
  if ($lines === false) return;
  foreach ($lines as $line) {
    $trim = trim($line);
    if ($trim === "" || str_starts_with($trim, "#")) continue;
    $parts = explode("=", $trim, 2);
    if (count($parts) !== 2) continue;
    $key = trim($parts[0]);
    $val = trim($parts[1]);
    if ($key === "") continue;
    if ((str_starts_with($val, "\"") && str_ends_with($val, "\"")) || (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
      $val = substr($val, 1, -1);
    }
    putenv("$key=$val");
    $_ENV[$key] = $val;
  }
}

// Load env from project root first, then fall back to public locations
load_env("/hdd/sites/stuartpringle/whisperspace/.env");
load_env("/hdd/sites/stuartpringle/whisperspace/public/.env");
load_env("/hdd/sites/stuartpringle/whisperspace/public/rules-api/.env");
load_env("/hdd/sites/stuartpringle/whisperspace/public/rules-api/calc/.env");

$headers = function_exists("getallheaders") ? getallheaders() : [];
$apiKey = $headers["X-WS-API-Key"] ?? $headers["x-ws-api-key"] ?? null;
$expected = $_SERVER["WS_RULES_API_KEY"] ?? ($_ENV["WS_RULES_API_KEY"] ?? (getenv("WS_RULES_API_KEY") ?: ""));

if ($path === "/debug") {
  echo json_encode([
    "hasServerEnv" => isset($_SERVER["WS_RULES_API_KEY"]),
    "hasEnv" => isset($_ENV["WS_RULES_API_KEY"]),
    "hasGetenv" => getenv("WS_RULES_API_KEY") !== false,
    "expectedLen" => strlen($expected),
  ]);
  exit;
}

if (!$expected) {
  http_response_code(500);
  echo json_encode(["error" => "server_not_configured"]);
  exit;
}

if (!$apiKey || !hash_equals($expected, $apiKey)) {
  http_response_code(401);
  echo json_encode(["error" => "unauthorized"]);
  exit;
}

$path = parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH) ?? "";
$path = preg_replace("#^/rules-api/calc#","", $path);
$path = rtrim($path, "/");

$raw = file_get_contents("php://input");
$body = json_decode($raw ?: "{}", true);
if (!is_array($body)) $body = [];

function fail(string $msg, int $code = 400): void {
  http_response_code($code);
  echo json_encode(["error" => $msg]);
  exit;
}

function build_attack_outcome(array $body): array {
  $total = isset($body["total"]) ? (int)$body["total"] : null;
  $useDC = isset($body["useDC"]) ? (int)$body["useDC"] : null;
  $weaponDamage = isset($body["weaponDamage"]) ? (int)$body["weaponDamage"] : null;
  $label = isset($body["label"]) ? (string)$body["label"] : "Attack";

  if ($total === null || $useDC === null || $weaponDamage === null) {
    fail("missing required fields: total, useDC, weaponDamage");
  }

  $margin = $total - $useDC;
  $hit = $total >= $useDC;
  $critExtra = 0;
  if ($margin >= 9) $critExtra = 4;
  else if ($margin >= 7) $critExtra = 3;
  else if ($margin >= 4) $critExtra = 2;

  $isCrit = $hit && $critExtra > 0;
  $baseDamage = $weaponDamage;
  $totalDamage = $hit ? $baseDamage + $critExtra : 0;
  $stressDelta = $isCrit ? 1 : 0;

  if (!$hit) {
    $message = "Miss. {$label} rolled {$total} vs DC {$useDC}.";
  } else if ($isCrit) {
    $message = "Extreme success - crit! {$label} rolled {$total} vs DC {$useDC}. Damage: {$baseDamage}+{$critExtra}={$totalDamage}. (+1 Stress)";
  } else {
    $message = "Hit. {$label} rolled {$total} vs DC {$useDC}. Damage: {$baseDamage}.";
  }

  return [
    "total" => $total,
    "useDC" => $useDC,
    "margin" => $margin,
    "hit" => $hit,
    "isCrit" => $isCrit,
    "critExtra" => $critExtra,
    "baseDamage" => $baseDamage,
    "totalDamage" => $totalDamage,
    "stressDelta" => $stressDelta,
    "message" => $message,
  ];
}

if ($path === "/attack") {
  $out = build_attack_outcome($body);
  echo json_encode($out);
  exit;
}

fail("unknown endpoint", 404);
