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
