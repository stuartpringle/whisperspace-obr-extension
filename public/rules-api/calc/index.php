<?php

declare(strict_types=1);

header("Content-Type: application/json");

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

$path = parse_url($_SERVER["REQUEST_URI"] ?? "", PHP_URL_PATH) ?? "";
$path = preg_replace("#^/rules-api/calc#", "", $path);
$path = rtrim($path, "/");

function client_ip(): string {
  $headers = function_exists("getallheaders") ? getallheaders() : [];
  $ip = $headers["CF-Connecting-IP"] ?? $headers["cf-connecting-ip"] ?? null;
  if (!$ip) {
    $xff = $headers["X-Forwarded-For"] ?? $headers["x-forwarded-for"] ?? "";
    if (is_string($xff) && $xff !== "") {
      $parts = explode(",", $xff);
      $ip = trim($parts[0] ?? "");
    }
  }
  if (!$ip) $ip = $_SERVER["REMOTE_ADDR"] ?? "unknown";
  return (string)$ip;
}

function rate_limit(int $limit, int $windowSeconds): void {
  $dir = sys_get_temp_dir() . "/whisperspace_calc_rate";
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
  $ip = client_ip();
  $key = preg_replace("/[^a-zA-Z0-9_.-]/", "_", $ip);
  $file = $dir . "/" . $key . ".json";
  $now = time();
  $data = ["windowStart" => $now, "count" => 0];

  $fh = @fopen($file, "c+");
  if ($fh) {
    flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    if ($raw !== false && $raw !== "") {
      $decoded = json_decode($raw, true);
      if (is_array($decoded) && isset($decoded["windowStart"], $decoded["count"])) {
        $data = $decoded;
      }
    }
    if (($now - (int)$data["windowStart"]) >= $windowSeconds) {
      $data = ["windowStart" => $now, "count" => 0];
    }
    $data["count"] = (int)$data["count"] + 1;

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
  }

  $reset = (int)$data["windowStart"] + $windowSeconds;
  $remaining = max(0, $limit - (int)$data["count"]);
  header("X-RateLimit-Limit: {$limit}");
  header("X-RateLimit-Remaining: {$remaining}");
  header("X-RateLimit-Reset: {$reset}");

  if ((int)$data["count"] > $limit) {
    http_response_code(429);
    header("Retry-After: " . max(1, $reset - $now));
    echo json_encode(["error" => "rate_limited"]);
    exit;
  }
}

rate_limit(120, 60);

if ($path === "/debug") {
  echo json_encode([
    "ok" => true,
  ]);
  exit;
}

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

function crit_extra_for_margin(int $margin): int {
  if ($margin >= 9) return 4;
  if ($margin >= 7) return 3;
  if ($margin >= 4) return 2;
  return 0;
}

function apply_damage_and_stress(array $body): array {
  $incoming = isset($body["incomingDamage"]) ? (int)$body["incomingDamage"] : 0;
  $stressDelta = isset($body["stressDelta"]) ? (int)$body["stressDelta"] : 0;
  $unmitigated = !empty($body["unmitigated"]);
  $armour = is_array($body["armour"] ?? null) ? $body["armour"] : null;
  $wounds = is_array($body["wounds"] ?? null) ? $body["wounds"] : ["light" => 0, "moderate" => 0, "heavy" => 0];
  $stress = is_array($body["stress"] ?? null) ? $body["stress"] : ["current" => 0, "cuf" => 0, "cufLoss" => 0];

  $incoming = max(0, (int)$incoming);
  if ($incoming <= 0 && $stressDelta <= 0) {
    return [
      "wounds" => $wounds,
      "armour" => $armour,
      "stress" => $stress,
      "stressDelta" => 0,
    ];
  }

  $armourBroken = (($armour["durability"]["current"] ?? 0) <= 0);
  $prot = ($unmitigated || $armourBroken) ? 0 : (int)($armour["protection"] ?? 0);
  $afterArmour = max(0, $incoming - $prot);

  $light = (int)($wounds["light"] ?? 0);
  $moderate = (int)($wounds["moderate"] ?? 0);
  $heavy = (int)($wounds["heavy"] ?? 0);

  $remaining = $afterArmour;
  $addedLight = 0;
  $addedModerate = 0;
  $addedHeavy = 0;

  $lightCap = 4;
  $addL = min($remaining, max(0, $lightCap - $light));
  $light += $addL; $remaining -= $addL; $addedLight = $addL;

  $modCap = 2;
  $addM = min($remaining, max(0, $modCap - $moderate));
  $moderate += $addM; $remaining -= $addM; $addedModerate = $addM;

  $heavyCap = 1;
  $addH = min($remaining, max(0, $heavyCap - $heavy));
  $heavy += $addH; $remaining -= $addH; $addedHeavy = $addH;

  $nextWounds = ["light" => $light, "moderate" => $moderate, "heavy" => $heavy];

  $stressInc = 0;
  if ($addedHeavy > 0) $stressInc = 4;
  else if ($addedModerate > 0) $stressInc = 2;
  else if ($addedLight > 0) $stressInc = 1;

  if ($stressDelta > 0) $stressInc += $stressDelta;

  $nextArmour = $armour;
  if (!$unmitigated && !$armourBroken && $afterArmour > 0 && isset($armour["durability"])) {
    $current = (int)($armour["durability"]["current"] ?? 0);
    $nextArmour = $armour;
    $nextArmour["durability"]["current"] = max(0, $current - 1);
  }

  $nextStress = max(0, (int)($stress["current"] ?? 0) + $stressInc);
  $nextStressState = $stress;
  $nextStressState["current"] = $nextStress;

  return [
    "wounds" => $nextWounds,
    "armour" => $nextArmour,
    "stress" => $nextStressState,
    "stressDelta" => $stressInc,
  ];
}

function derive_attributes(array $body): array {
  $skills = is_array($body["skills"] ?? null) ? $body["skills"] : [];
  $inherent = is_array($body["inherentSkills"] ?? null) ? $body["inherentSkills"] : [];
  $sums = ["phys" => 0, "ref" => 0, "soc" => 0, "ment" => 0];

  foreach ($inherent as $s) {
    $id = (string)($s["id"] ?? "");
    $attr = (string)($s["attribute"] ?? "");
    if (!isset($sums[$attr])) continue;
    $rank = (int)($skills[$id] ?? 0);
    $sums[$attr] += max(0, $rank);
  }

  return [
    "phys" => max(0, (int)ceil($sums["phys"] / 4)),
    "ref" => max(0, (int)ceil($sums["ref"] / 4)),
    "soc" => max(0, (int)ceil($sums["soc"] / 4)),
    "ment" => max(0, (int)ceil($sums["ment"] / 4)),
  ];
}

function derive_cuf(array $body): array {
  $skills = is_array($body["skills"] ?? null) ? $body["skills"] : [];
  $ids = ["instinct", "willpower", "bearing", "toughness", "tactics"];
  $sum = 0;
  foreach ($ids as $id) {
    $sum += max(0, (int)($skills[$id] ?? 0));
  }
  return ["cuf" => 1 + (int)ceil($sum / 5)];
}

function build_skill_notation(array $body): array {
  $netDice = isset($body["netDice"]) ? (int)$body["netDice"] : 0;
  $modifier = isset($body["modifier"]) ? (int)$body["modifier"] : 0;
  $label = isset($body["label"]) ? (string)$body["label"] : "";

  $net = max(-2, min(2, (int)$netDice));
  $diceCount = 1 + abs($net);
  $base = "1d12";
  if ($net > 0) $base = $diceCount . "d12kh1";
  if ($net < 0) $base = $diceCount . "d12kl1";

  $mod = (int)$modifier;
  $modSuffix = $mod === 0 ? "" : ($mod > 0 ? " +".$mod : " ".$mod);
  return ["notation" => $base . " # " . $label . $modSuffix];
}

function build_learned_info_by_id(array $learned): array {
  $map = [];
  foreach ($learned as $focus => $list) {
    if (!is_array($list)) continue;
    foreach ($list as $s) {
      $id = (string)($s["id"] ?? "");
      if ($id === "") continue;
      $map[$id] = ["focus" => $focus];
    }
  }
  return $map;
}

function skill_modifier_for(array $body): array {
  $learned = is_array($body["learnedByFocus"] ?? null) ? $body["learnedByFocus"] : [];
  $learnedMap = build_learned_info_by_id($learned);
  $skillId = (string)($body["skillId"] ?? "");
  $ranks = is_array($body["ranks"] ?? null) ? $body["ranks"] : [];
  $learningFocus = (string)($body["learningFocus"] ?? "combat");
  $mods = is_array($body["skillMods"] ?? null) ? $body["skillMods"] : [];

  $rank = (int)($ranks[$skillId] ?? 0);
  $bonus = (int)($mods[$skillId] ?? 0);
  if ($rank > 0) return ["modifier" => $rank + $bonus];

  $learnedInfo = $learnedMap[$skillId] ?? null;
  $base = ($learnedInfo && ($learnedInfo["focus"] ?? "") === $learningFocus) ? 0 : -1;
  return ["modifier" => $base + $bonus];
}

function parse_status_effects(string $raw): array {
  $deltas = [];
  if ($raw === "") return $deltas;
  $parts = array_filter(array_map("trim", explode(",", $raw)));
  foreach ($parts as $part) {
    if (!preg_match("/^([a-zA-Z0-9_\\-]+)\\s*[:]??\\s*([+\\-])\\s*(\\d+)$/", $part, $m)) continue;
    $key = strtolower(preg_replace("/\\s+/", "_", $m[1]));
    $sign = $m[2] === "-" ? -1 : 1;
    $amt = (int)$m[3];
    $deltas[$key] = ($deltas[$key] ?? 0) + $sign * $amt;
  }
  return $deltas;
}

function merge_status_deltas(array $statuses): array {
  $out = [];
  foreach ($statuses as $raw) {
    if (!is_string($raw)) continue;
    $m = parse_status_effects($raw);
    foreach ($m as $k => $v) {
      $out[$k] = ($out[$k] ?? 0) + $v;
    }
  }
  return $out;
}

function apply_status_to_derived(array $derived, array $deltas): array {
  $next = $derived;
  $add = function(string $key, int $val) use (&$next) {
    if (!is_numeric($val) || $val == 0) return;
    $next[$key] = (int)($next[$key] ?? 0) + $val;
  };

  $add("phys", (int)($deltas["phys"] ?? 0));
  $add("ref", (int)($deltas["ref"] ?? 0));
  $add("soc", (int)($deltas["soc"] ?? 0));
  $add("ment", (int)($deltas["ment"] ?? 0));
  $add("coolUnderFire", (int)($deltas["cool_under_fire"] ?? 0));
  $add("speed", (int)($deltas["speed"] ?? 0));
  $add("carryingCapacity", (int)($deltas["carrying_capacity"] ?? 0));

  foreach ($deltas as $k => $v) {
    if (in_array($k, ["phys","ref","soc","ment","cool_under_fire","speed","carrying_capacity"], true)) continue;
    if (is_numeric($next[$k] ?? null)) {
      $next[$k] = (int)$next[$k] + (int)$v;
    }
  }
  return $next;
}

function ammo_max(array $body): array {
  $weapon = is_array($body["weapon"] ?? null) ? $body["weapon"] : [];
  $raw = $weapon["keywordParams"]["ammoMax"] ?? null;
  $max = is_numeric($raw) ? (int)$raw : 0;
  return ["ammoMax" => max(0, $max)];
}

if ($path === "/attack") {
  echo json_encode(build_attack_outcome($body));
  exit;
}
if ($path === "/crit-extra") {
  $margin = isset($body["margin"]) ? (int)$body["margin"] : null;
  if ($margin === null) fail("missing required fields: margin");
  echo json_encode(["critExtra" => crit_extra_for_margin($margin)]);
  exit;
}
if ($path === "/damage") {
  echo json_encode(apply_damage_and_stress($body));
  exit;
}
if ($path === "/derive-attributes") {
  echo json_encode(derive_attributes($body));
  exit;
}
if ($path === "/derive-cuf") {
  echo json_encode(derive_cuf($body));
  exit;
}
if ($path === "/skill-notation") {
  echo json_encode(build_skill_notation($body));
  exit;
}
if ($path === "/skill-mod") {
  echo json_encode(skill_modifier_for($body));
  exit;
}
if ($path === "/status-deltas") {
  $statuses = is_array($body["statuses"] ?? null) ? $body["statuses"] : [];
  echo json_encode(["deltas" => merge_status_deltas($statuses)]);
  exit;
}
if ($path === "/status-apply") {
  $derived = is_array($body["derived"] ?? null) ? $body["derived"] : [];
  $statuses = is_array($body["statuses"] ?? null) ? $body["statuses"] : [];
  $deltas = merge_status_deltas($statuses);
  echo json_encode(["derived" => apply_status_to_derived($derived, $deltas), "deltas" => $deltas]);
  exit;
}
if ($path === "/ammo-max") {
  echo json_encode(ammo_max($body));
  exit;
}

fail("unknown endpoint", 404);
