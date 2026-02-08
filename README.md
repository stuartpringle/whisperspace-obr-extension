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

### Calc Endpoints (PHP)

Auth:
- `Authorization: Bearer <your key>`
- `?api_key=<your key>` (fallback)

All endpoints are `POST` and accept JSON bodies.

Endpoints:
- `/rules-api/calc/attack`
- `/rules-api/calc/crit-extra`
- `/rules-api/calc/damage`
- `/rules-api/calc/derive-attributes`
- `/rules-api/calc/derive-cuf`
- `/rules-api/calc/skill-notation`
- `/rules-api/calc/skill-mod`
- `/rules-api/calc/status-deltas`
- `/rules-api/calc/status-apply`
- `/rules-api/calc/ammo-max`

Example: `POST https://whisperspace.com/rules-api/calc/attack`

Body:
```json
{
  "total": 11,
  "useDC": 8,
  "weaponDamage": 4,
  "label": "Shotgun"
}
```

Response:
```json
{
  "total": 11,
  "useDC": 8,
  "margin": 3,
  "hit": true,
  "isCrit": false,
  "critExtra": 0,
  "baseDamage": 4,
  "totalDamage": 4,
  "stressDelta": 0,
  "message": "Hit. Shotgun rolled 11 vs DC 8. Damage: 4."
}
```

Quick payload shapes:
- `/attack`: `{ total, useDC, weaponDamage, label? }`
- `/crit-extra`: `{ margin }`
- `/damage`: `{ incomingDamage, stressDelta?, unmitigated?, armour?, wounds?, stress? }`
- `/derive-attributes`: `{ skills, inherentSkills }`
- `/derive-cuf`: `{ skills }`
- `/skill-notation`: `{ netDice, modifier, label }`
- `/skill-mod`: `{ learnedByFocus, skillId, ranks?, learningFocus?, skillMods? }`
- `/status-deltas`: `{ statuses: string[] }`
- `/status-apply`: `{ derived, statuses: string[] }`
- `/ammo-max`: `{ weapon }`

### Core Hooks

You can subscribe to hooks exposed by the core module:

```js
import { getHookBus } from "https://whisperspace.com/rules-api/latest/core/index.js";

const off = getHookBus().on("attack:resolved", (payload) => {
  console.log("Attack resolved:", payload);
});

// later:
off();
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

### Cache Headers (ETag + Cache-Control)

If you want cheap revalidation, add ETag + cache headers in Apache. Example:

```apache
<Directory /hdd/sites/stuartpringle/whisperspace/public/rules-api>
    <IfModule mod_headers.c>
        Header set Cache-Control "public, max-age=300, must-revalidate"
        Header set ETag "expr=%{REQUEST_URI}-%{FILE_SIZE}-%{FILE_MTIME}"
    </IfModule>

    <IfModule mod_expires.c>
        ExpiresActive On
        ExpiresDefault "access plus 5 minutes"
    </IfModule>
</Directory>
```

Note: your vhost currently has `AllowOverride None`, so put these in the vhost config (not `.htaccess`).
