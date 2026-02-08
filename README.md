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
- `npm run build` — runs rules sync, then builds the extension.
