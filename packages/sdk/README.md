# @whisperspace/sdk

A minimal client and shared type definitions for the Whisperspace rules and calc APIs.

## Install (local workspace)

```ts
import { RULES_API_BASE, CALC_API_BASE } from "@whisperspace/sdk";
import {
  calcAttack,
  calcDamage,
  calcDeriveAttributes,
  calcDeriveCuf,
  calcSkillNotation,
  calcSkillMod,
  calcStatusDeltas,
  calcStatusApply,
  calcAmmoMax,
} from "@whisperspace/sdk";
```

## Endpoints

Rules API:
- `GET ${RULES_API_BASE}/meta.json`
- `GET ${RULES_API_BASE}/rules.json`

Calc API:
- `POST ${CALC_API_BASE}/attack`
- `POST ${CALC_API_BASE}/crit-extra`
- `POST ${CALC_API_BASE}/damage`
- `POST ${CALC_API_BASE}/derive-attributes`
- `POST ${CALC_API_BASE}/derive-cuf`
- `POST ${CALC_API_BASE}/skill-notation`
- `POST ${CALC_API_BASE}/skill-mod`
- `POST ${CALC_API_BASE}/status-deltas`
- `POST ${CALC_API_BASE}/status-apply`
- `POST ${CALC_API_BASE}/ammo-max`

Schemas:
- `https://whisperspace.com/rules-api/calc/schemas/index.json`

## Versioning

SDK version is kept in lockstep with the rules API version.
- Source of truth: `package.json` at repo root (`rulesVersion`).
- SDK `package.json` is updated to match on each `rules:publish`/`build`.
