# Whisperspace OBR Sheet + Rules Reference

This repo contains two Owlbear Rodeo extensions:

1. **Whisperspace Character Sheet** (token-backed sheet)
2. **Whisperspace Rules Reference** (shared rules viewer)

## Install in OBR

Add these manifests in Owlbear Rodeo:

- `dist/manifest.json` — Character Sheet
- `dist/manifest.rules.json` — Rules Reference

## Rules Data Workflow

Rules data comes from the **Whisperspace Rules Parser**. That parser ingests the Google Doc export and outputs YAML files.

Parser README:
`/hdd/sites/stuartpringle/whisperspace-rules-parser/README.md`

### Update Rules

1. Update the Google Doc and run the parser:
   ```bash
   PYTHONPATH=src python3 -m whisperspace_rules_parser.cli --out out
   ```
2. Sync rules into this repo:
   ```bash
   npm run rules:sync
   ```
   This copies YAML files into `src/data/rules/` and regenerates `src/data/generated/rules.json`.

3. Build:
   ```bash
   npm run build
   ```

### Where Rules Live

- Source YAML: `src/data/rules/*.yaml`
- Generated JSON: `src/data/generated/rules.json`
- Rules UI entry: `rules.html` + `src/rules-main.tsx` + `src/ui/RulesApp.tsx`

## Scripts

- `npm run rules:sync` — copy parser output into `src/data/rules/` and regenerate JSON.
- `npm run rules:gear` — parse equipment tables from `src/data/rules/equipment-gear.yaml` into data YAML files.
- `npm run rules:publish` — run the parser, sync rules, build/publish the HTTP rules API + core module.
- `npm run build` — runs rules sync, then builds the extension.

## HTTP Rules API

The latest rules API is published to:

- `https://whisperspace.com/rules-api/latest/`

Key files:

- `rules.json` (full rules tree)
- `skills.json`, `weapons.json`, `armour.json`, `items.json`, `cyberware.json`, `narcotics.json`, `hacking_gear.json`
- `weapon_keywords.json`, `skill_tooltips.json`
- `meta.json` (semver + hashes)

### Core Module (HTTP)

The shared core logic is available as an ES module:

```js
import { buildAttackOutcome, deriveAttributesFromSkills } from "https://whisperspace.com/rules-api/latest/core/index.js";
```

### CORS

Apache should allow cross‑origin access for the rules API path. Example:

```apache
<Directory /hdd/sites/stuartpringle/whisperspace/public/rules-api>
    Options -Indexes
    AllowOverride None
    Require all granted

    <IfModule mod_headers.c>
        Header set Access-Control-Allow-Origin "*"
        Header set Access-Control-Allow-Methods "GET, OPTIONS"
        Header set Access-Control-Allow-Headers "Content-Type"
    </IfModule>
</Directory>

AddType application/json .json
```
