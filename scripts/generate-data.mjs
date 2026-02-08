// scripts/generate-data.mjs
// Generates JSON from YAML files in src/data into src/data/generated
// Then archives selected project files/folders into a .tar.gz

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";
import { create as tarCreate } from "tar";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src", "data");
const OUT = path.join(SRC, "generated");

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

main().catch((err) => {
  console.error("[generate-data] Failed:", err);
  process.exitCode = 1;
});
