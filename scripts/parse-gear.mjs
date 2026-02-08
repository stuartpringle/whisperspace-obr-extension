// scripts/parse-gear.mjs
// Parse rules gear tables from src/data/rules/equipment-gear.yaml into data YAML files.

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const ROOT = process.cwd();
const RULES_GEAR = path.join(ROOT, "src", "data", "rules", "equipment-gear.yaml");

const OUT_WEAPONS = path.join(ROOT, "src", "data", "weapons.yaml");
const OUT_ARMOR = path.join(ROOT, "src", "data", "armor.yaml");
const OUT_ITEMS = path.join(ROOT, "src", "data", "items.yaml");
const OUT_CYBERWARE = path.join(ROOT, "src", "data", "cyberware.yaml");
const OUT_NARCOTICS = path.join(ROOT, "src", "data", "narcotics.yaml");
const OUT_HACKING = path.join(ROOT, "src", "data", "hacking_gear.yaml");

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseNumber(v, fallback = 0) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function parseTier(v) {
  const m = String(v ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : parseNumber(v, 0);
}

function splitKeywords(text) {
  const raw = String(text ?? "").trim();
  if (!raw || raw === "-") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function tableToTextRows(table) {
  return (table?.rows ?? []).map((row) => row.map((cell) => String(cell?.text ?? "").trim()));
}

function collectTables(node, out = []) {
  const content = node?.content ?? [];
  content.forEach((b) => {
    if (b?.type === "table") out.push(b);
  });
  (node?.sections ?? []).forEach((s) => collectTables(s, out));
  return out;
}

function getCategory(tableRows) {
  const first = (tableRows[0] ?? [])[0] ?? "";
  return first.trim().toLowerCase();
}

function buildIndexMap(headerRow) {
  const map = new Map();
  headerRow.forEach((h, i) => {
    map.set(String(h).toLowerCase(), i);
  });
  return map;
}

function getCell(row, map, key) {
  const idx = map.get(key);
  if (idx === undefined) return "";
  return row[idx] ?? "";
}

function parseWeapons(tableRows) {
  const header = tableRows[1] ?? [];
  const map = buildIndexMap(header);
  const out = [];
  for (const row of tableRows.slice(2)) {
    const name = getCell(row, map, "name");
    if (!name) continue;
    const type = getCell(row, map, "type");
    const id = slugify(name);
    const typeNorm = String(type).toLowerCase();
    let skillId = "weapons_medium";
    if (typeNorm.startsWith("light")) skillId = "weapons_light";
    else if (typeNorm.startsWith("med")) skillId = "weapons_medium";
    else if (typeNorm.startsWith("heavy")) skillId = "weapons_heavy";
    else if (typeNorm.startsWith("exotic")) skillId = "weapons_exotic";
    else if (typeNorm.startsWith("melee")) skillId = "melee_weapons";
    else if (typeNorm.startsWith("unarmed")) skillId = "melee_unarmed";

    const dc = parseNumber(getCell(row, map, "dc"));
    const dmg = parseNumber(getCell(row, map, "dmg"));
    const rng = getCell(row, map, "rng");
    const ammo = parseNumber(getCell(row, map, "ammo"));
    const bulk = parseNumber(getCell(row, map, "blk"));
    const req = getCell(row, map, "req.") || getCell(row, map, "req");
    const special = getCell(row, map, "special");
    const cost = parseNumber(getCell(row, map, "cost"));

    const item = {
      id,
      name,
      skillId,
      useDC: dc,
      damage: dmg,
      range: rng,
      ammo,
      bulk,
      cost,
    };
    if (req && req !== "-") item.req = req;
    const keywords = splitKeywords(special);
    if (keywords.length) item.keywords = keywords;
    out.push(item);
  }
  return out;
}

function parseArmor(tableRows) {
  const header = tableRows[1] ?? [];
  const map = buildIndexMap(header);
  const out = [];
  for (const row of tableRows.slice(2)) {
    const name = getCell(row, map, "name");
    if (!name) continue;
    const id = slugify(name);
    const prot = parseNumber(getCell(row, map, "prot"));
    const durability = parseNumber(getCell(row, map, "durability"));
    const bulk = parseNumber(getCell(row, map, "blk"));
    const req = getCell(row, map, "req.") || getCell(row, map, "req");
    const special = getCell(row, map, "special");
    const cost = parseNumber(getCell(row, map, "cost"));

    const item = {
      id,
      name,
      protection: prot,
      durability,
      bulk,
      cost,
    };
    if (req && req !== "-") item.req = req;
    if (special && special !== "-") item.special = special;
    out.push(item);
  }
  return out;
}

function parseItems(tableRows) {
  const header = tableRows[1] ?? [];
  const map = buildIndexMap(header);
  const out = [];
  for (const row of tableRows.slice(2)) {
    const name = getCell(row, map, "item name") || getCell(row, map, "name");
    if (!name) continue;
    const effect = getCell(row, map, "effect");
    const uses = getCell(row, map, "uses");
    const bulk = parseNumber(getCell(row, map, "bulk"));
    const cost = parseNumber(getCell(row, map, "cost"));
    out.push({ name, effect, uses, bulk, cost });
  }
  return out;
}

function parseCyberware(tableRows) {
  const header = tableRows[1] ?? [];
  const map = buildIndexMap(header);
  const out = [];
  for (const row of tableRows.slice(2)) {
    const name = getCell(row, map, "name");
    if (!name) continue;
    const tier = parseTier(getCell(row, map, "tier"));
    const effect = getCell(row, map, "effect");
    const installationDifficulty = parseNumber(getCell(row, map, "installation difficulty"));
    const requirements = getCell(row, map, "req.") || getCell(row, map, "req");
    const physicalImpact = getCell(row, map, "physical impact");
    const cost = parseNumber(getCell(row, map, "cost"));
    out.push({
      name,
      tier,
      effect,
      installationDifficulty,
      requirements: requirements || "-",
      physicalImpact,
      bulk: 1,
      cost,
    });
  }
  return out;
}

function parseNarcotics(tableRows) {
  const header = tableRows[1] ?? [];
  const map = buildIndexMap(header);
  const out = [];
  for (const row of tableRows.slice(2)) {
    const name = getCell(row, map, "name");
    if (!name) continue;
    const effect = getCell(row, map, "effect");
    const uses = parseNumber(getCell(row, map, "uses"));
    const addictionScore = parseNumber(getCell(row, map, "addiction score"));
    const legality = getCell(row, map, "legality");
    const cost = parseNumber(getCell(row, map, "cost"));
    out.push({ name, effect, uses, addictionScore, legality, bulk: 1, cost });
  }
  return out;
}

function parseRigs(tableRows) {
  const header = tableRows[1] ?? [];
  const map = buildIndexMap(header);
  const out = [];
  for (const row of tableRows.slice(2)) {
    const name = getCell(row, map, "name");
    if (!name) continue;
    const systemTierAccess = parseTier(getCell(row, map, "system tier access"));
    const maxSoftwareTier = parseTier(getCell(row, map, "max software tier"));
    const bulk = parseNumber(getCell(row, map, "bulk"));
    const cost = parseNumber(getCell(row, map, "cost"));
    out.push({ name, systemTierAccess, maxSoftwareTier, bulk, cost });
  }
  return out;
}

function parseSoftware(tableRows) {
  const header = tableRows[1] ?? [];
  const map = buildIndexMap(header);
  const out = [];
  for (const row of tableRows.slice(2)) {
    const name = getCell(row, map, "software") || getCell(row, map, "name");
    if (!name) continue;
    const tier = parseTier(getCell(row, map, "tier"));
    const notes = getCell(row, map, "notes");
    const cost = parseNumber(getCell(row, map, "cost"));
    out.push({ name, tier, notes, cost });
  }
  return out;
}

function writeYaml(filePath, data) {
  const doc = YAML.stringify(data, { indent: 2 });
  fs.writeFileSync(filePath, doc, "utf8");
}

function main() {
  if (!fs.existsSync(RULES_GEAR)) {
    console.error(`[parse-gear] Missing ${RULES_GEAR}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(RULES_GEAR, "utf8");
  const parsed = YAML.parse(raw);
  const tables = collectTables(parsed, []);

  let weapons = [];
  let armor = [];
  let items = [];
  let cyberware = [];
  let narcotics = [];
  let rigs = [];
  let software = [];

  for (const table of tables) {
    const rows = tableToTextRows(table);
    if (rows.length < 2) continue;
    const cat = getCategory(rows);
    if (cat === "weapons") weapons = parseWeapons(rows);
    else if (cat === "armour" || cat === "armor") armor = parseArmor(rows);
    else if (cat === "items") items = parseItems(rows);
    else if (cat === "cyberware") cyberware = parseCyberware(rows);
    else if (cat === "narcotics") narcotics = parseNarcotics(rows);
    else if (cat === "rigs") rigs = parseRigs(rows);
    else if (cat === "software") software = parseSoftware(rows);
  }

  writeYaml(OUT_WEAPONS, { weapons });
  writeYaml(OUT_ARMOR, { armor });
  writeYaml(OUT_ITEMS, { items });
  writeYaml(OUT_CYBERWARE, { cyberware });
  writeYaml(OUT_NARCOTICS, { narcotics });
  writeYaml(OUT_HACKING, { rigs, software });

  console.log("[parse-gear] Wrote weapons, armor, items, cyberware, narcotics, hacking_gear.");
}

main();
