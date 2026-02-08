// scripts/generate-data.mjs
// Generates JSON from YAML files in src/data into src/data/generated
// Then archives selected project files/folders into a .tar.gz

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import YAML from "yaml";
import { create as tarCreate } from "tar";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src", "data");
const OUT = path.join(SRC, "generated");
const RULES_API_DIR = path.join(ROOT, "public", "rules-api", "latest");

//enable/disable the TAR behaviour here
const ENABLE_ARCHIVE = false;

const files = [
  { in: "skills.yaml", out: "skills.json" },
  { in: "weapons.yaml", out: "weapons.json" },
  { in: "armor.yaml", out: "armor.json" },
  { in: "weapon_keywords.yaml", out: "weapon_keywords.json" },
  { in: "items.yaml", out: "items.json" },
  { in: "cyberware.yaml", out: "cyberware.json" },
  { in: "narcotics.yaml", out: "narcotics.json" },
  { in: "hacking_gear.yaml", out: "hacking_gear.json" },
];

function timestamp() {
  // YYYYMMDD-HHMMSS (local time)
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  for (const f of files) {
    const inPath = path.join(SRC, f.in);
    const outPath = path.join(OUT, f.out);

    if (!fs.existsSync(inPath)) {
      console.warn(`[generate-data] Missing ${inPath} (skipping)`);
      continue;
    }

    const raw = fs.readFileSync(inPath, "utf8");
    const parsed = YAML.parse(raw);

    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`[generate-data] Wrote ${path.relative(ROOT, outPath)}`);
  }

  // --- Rules YAML aggregation ---
  const RULES_DIR = path.join(SRC, "rules");
  const RULES_OUT = path.join(OUT, "rules.json");
  const TOOLTIP_OUT = path.join(OUT, "skill_tooltips.json");
  if (fs.existsSync(RULES_DIR)) {
    const ruleFiles = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".yaml")).sort();
    const docs = [];
    for (const filename of ruleFiles) {
      const inPath = path.join(RULES_DIR, filename);
      const raw = fs.readFileSync(inPath, "utf8");
      const parsed = YAML.parse(raw);
      docs.push({ file: filename, ...parsed });
    }
    fs.writeFileSync(RULES_OUT, JSON.stringify(docs, null, 2) + "\n", "utf8");
    console.log(`[generate-data] Wrote ${path.relative(ROOT, RULES_OUT)}`);

    const attrSkillsPath = path.join(RULES_DIR, "attributes-and-skills.yaml");
    if (fs.existsSync(attrSkillsPath)) {
      const raw = fs.readFileSync(attrSkillsPath, "utf8");
      const parsed = YAML.parse(raw);
      const { attributes, skills } = extractSkillTooltips(parsed);
      fs.writeFileSync(TOOLTIP_OUT, JSON.stringify({ attributes, skills }, null, 2) + "\n", "utf8");
      console.log(`[generate-data] Wrote ${path.relative(ROOT, TOOLTIP_OUT)}`);
    } else {
      console.warn(`[generate-data] Missing ${path.relative(ROOT, attrSkillsPath)} (skipping tooltips)`);
    }
  } else {
    console.warn(`[generate-data] Rules directory missing: ${path.relative(ROOT, RULES_DIR)} (skipping)`);
  }

  writeRulesApiBundle();

  await archiveProject({ enabled: ENABLE_ARCHIVE });
}

async function archiveProject({ enabled }) {
  if (!enabled) return;

  // --- Archive step (final) ---
  const targets = [
    "scripts",
    "src",
    "public",
    ".tool-versions",
    "background.html",
    "index.html",
    "package.json",
    "package-lock.json",
    "README.md",
    "tsconfig.json",
    "tsconfig.node.json",
    "tsconfig.tsbuildinfo",
    "vite.config.ts",
  ];

  // Only include things that exist; warn on missing
  const existing = targets.filter((p) => {
    const abs = path.join(ROOT, p);
    const ok = fs.existsSync(abs);
    if (!ok) console.warn(`[generate-data] Archive target missing: ${p} (skipping)`);
    return ok;
  });

  const ARCHIVE_DIR = "./";
  const ARCHIVE_PATH = path.join(ARCHIVE_DIR, `project-${timestamp()}.tar.gz`);

  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  await tarCreate(
    {
      gzip: true,
      file: ARCHIVE_PATH,
      cwd: ROOT,
      portable: true,
    },
    existing
  );

  console.log(`[generate-data] Archived -> ${path.relative(ROOT, ARCHIVE_PATH)}`);
}

function collectTables(node, out = []) {
  const content = node?.content ?? [];
  for (const block of content) {
    if (block?.type === "table") out.push(block);
  }
  const sections = node?.sections ?? [];
  for (const section of sections) collectTables(section, out);
  return out;
}

function cleanDescription(text) {
  return String(text ?? "")
    .replace(/([a-z])([A-Z][a-z])/g, "$1. $2")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSkillTooltips(ruleDoc) {
  const tables = collectTables(ruleDoc, []);
  const attributes = {};
  const skills = {};

  for (const table of tables) {
    const rows = (table?.rows ?? []).map((row) => row.map((cell) => String(cell?.text ?? "").trim()));
    if (!rows.length) continue;
    let headerRowIndex = 0;
    let dataStartIndex = 1;
    if (rows[0].length === 1 && rows.length > 1) {
      headerRowIndex = 1;
      dataStartIndex = 2;
    }
    const header = rows[headerRowIndex].map((h) => h.toLowerCase());

    const isAttributeTable =
      header.includes("attribute") && header.includes("short form") && header.includes("description");
    if (isAttributeTable) {
      for (const row of rows.slice(dataStartIndex)) {
        const shortForm = row[1];
        const description = cleanDescription(row[2]);
        if (!shortForm || !description) continue;
        attributes[shortForm] = description;
      }
      continue;
    }

    const hasDescription = header.some((h) => h.includes("description"));
    const hasSkillsLabel = header[0]?.includes("skills") || header[0]?.includes("skill");
    if (!hasDescription || !hasSkillsLabel) continue;

    if (header.length >= 3 && header.some((h) => h.includes("max rank"))) {
      for (const row of rows.slice(dataStartIndex)) {
        const name = row[0];
        const description = cleanDescription(row[2]);
        if (!name || !description) continue;
        if (!skills[name]) skills[name] = description;
      }
    } else if (header.length >= 2) {
      for (const row of rows.slice(dataStartIndex)) {
        const name = row[0];
        const description = cleanDescription(row[1]);
        if (!name || !description) continue;
        if (!skills[name]) skills[name] = description;
      }
    }
  }

  return { attributes, skills };
}

function writeRulesApiBundle() {
  const filesToCopy = [
    "skills.json",
    "weapons.json",
    "armor.json",
    "weapon_keywords.json",
    "items.json",
    "cyberware.json",
    "narcotics.json",
    "hacking_gear.json",
    "rules.json",
    "skill_tooltips.json",
  ];

  fs.mkdirSync(RULES_API_DIR, { recursive: true });

  const meta = {
    version: timestamp(),
    generatedAt: new Date().toISOString(),
    files: {},
  };

  for (const filename of filesToCopy) {
    const srcPath = path.join(OUT, filename);
    if (!fs.existsSync(srcPath)) {
      console.warn(`[generate-data] Missing ${path.relative(ROOT, srcPath)} (skipping rules-api)`);
      continue;
    }
    const data = fs.readFileSync(srcPath);
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    const destPath = path.join(RULES_API_DIR, filename);
    fs.writeFileSync(destPath, data);
    meta.files[filename] = {
      sha256: hash,
      bytes: data.length,
    };
  }

  const metaPath = path.join(RULES_API_DIR, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  console.log(`[generate-data] Wrote ${path.relative(ROOT, metaPath)}`);
}

main().catch((err) => {
  console.error("[generate-data] Failed:", err);
  process.exitCode = 1;
});
