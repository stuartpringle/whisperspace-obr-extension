#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-/hdd/sites/stuartpringle/whisperspace-rules-parser/out}"
DEST_DIR="src/data/rules"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "[import-rules] Source directory not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
rm -f "$DEST_DIR"/*.yaml
cp "$SRC_DIR"/*.yaml "$DEST_DIR"/

echo "[import-rules] Copied YAML files from $SRC_DIR to $DEST_DIR"

echo "[import-rules] Parsing gear tables..."
node scripts/parse-gear.mjs

echo "[import-rules] Regenerating JSON..."
npm run generate:data
