#!/usr/bin/env bash
set -euo pipefail

PARSER_ROOT="/hdd/sites/stuartpringle/whisperspace-rules-parser"
PARSER_OUT="${PARSER_ROOT}/out"

echo "[rules:publish] Running rules parser..."
PYTHONPATH="${PARSER_ROOT}/src" python3 -m whisperspace_rules_parser.cli --out "${PARSER_OUT}"

rm -f doc-export.zip

echo "[rules:publish] Building core HTTP module..."
bash scripts/core-build.sh

echo "[rules:publish] Syncing parser output + generating API bundle..."
bash scripts/import-rules.sh "${PARSER_OUT}"

echo "[rules:publish] Syncing SDK version to rulesVersion..."
node -e "const fs=require('fs');const root=require('./package.json');const sdk=JSON.parse(fs.readFileSync('packages/sdk/package.json','utf8'));sdk.version = root.rulesVersion || sdk.version;fs.writeFileSync('packages/sdk/package.json', JSON.stringify(sdk,null,2)+'\\n');"

echo "[rules:publish] Publishing calc endpoints..."
mkdir -p /hdd/sites/stuartpringle/whisperspace/public/rules-api/calc
cp public/rules-api/calc/index.php /hdd/sites/stuartpringle/whisperspace/public/rules-api/calc/index.php
cp public/rules-api/calc/.htaccess /hdd/sites/stuartpringle/whisperspace/public/rules-api/calc/.htaccess
mkdir -p /hdd/sites/stuartpringle/whisperspace/public/rules-api/calc/schemas
cp public/rules-api/calc/schemas/*.json /hdd/sites/stuartpringle/whisperspace/public/rules-api/calc/schemas/
