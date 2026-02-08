# Whisperspace Sheet — Owlbear Rodeo Extension (Dev)

This is a minimal working Owlbear Rodeo extension that:
- stores a Whisperspace character sheet on a token’s metadata
- provides a **My Sheet** action button (top-left)
- provides a right-click **Open Whisperspace Sheet** context menu item
  - opens that token’s sheet without overwriting “My Character”

## Ubuntu quickstart

### 1) Install Node (if needed)
Recommended: Node 20 LTS.

### 2) Install deps
```bash
npm install
```

### 3) Run dev server
```bash
npm run dev -- --host
```

You should have:
- http://localhost:5173/manifest.json

### 4) Install in Owlbear Rodeo
1. Open Owlbear Rodeo
2. Profile → Extensions → Add Extension
3. Paste: `http://localhost:5173/manifest.json`
4. Enter a room and enable the extension

## Test flows

### My Sheet (primary)
- Click the action icon (top-left)
- If prompted, select a token → click “Set Selected Token as My Character”

### Right-click → Open Sheet
- Select a token → right-click → “Open Whisperspace Sheet”
- A popover opens for that token
- “Back to My Sheet” returns to your own character

## Notes
- Skills are data-driven via `src/data/generated/skills.json` (source YAML is `src/data/skills.yaml`).
- The sheet is stored per-token under metadata key `com.whisperspace.sheet/character`.


## SDK versions
If npm complains about missing versions, check available releases:
```bash
npm view @owlbear-rodeo/sdk versions
```
This project targets SDK ^3.1.0.


## Build note
This extension uses two entrypoints (index.html + background.html). Vite is configured with multi-page inputs.
