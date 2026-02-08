import React, { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { CharacterSheetV1 } from "../../rules/schema";
import { skillsData } from "../../data/skills";
import type { SkillDef } from "../../data/types";

import { WEAPON_TEMPLATES } from "../../data/weapons";
import { ARMOR_TEMPLATES } from "../../data/armor";
import { rollWithDicePlusTotal } from "../diceplus/roll";
import { Button } from "@mui/material";
import CasinoIcon from "@mui/icons-material/Casino";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReplayIcon from "@mui/icons-material/Replay";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from "@mui/material";

import { buildWhisperspaceSkillNotation, rollWithDicePlus } from "../diceplus/roll";
import { rollWeaponAttackAndBroadcast, type CombatLogPayload } from "../combat/weaponAttack";
import { applyDamageAndStress } from "../combat/applyDamage";
import { makeLearnedInfoById, skillModifierFor } from "../combat/skills";
import { getAmmoMax } from "../combat/weapons";
import { CombatLog } from "../combat/CombatLog";
import { resolveWeaponKeyword } from "../weaponKeywords";

export function CombatPanel(props: {
  sheet: CharacterSheetV1;
  tokenId: string;
  onChange: (patch: Partial<CharacterSheetV1>) => void;
  onApplyStress?: (nextStress: number) => void;
  skillMods?: Record<string, number>;
  combatLog?: CombatLogPayload[];
  onApplyCombatLog?: (entry: CombatLogPayload) => void;
  isGM?: boolean;
}) {
  const s = props.sheet;
  const [netDice, setNetDice] = useState<-2 | -1 | 0 | 1 | 2>(0);
  const [dragWeaponIndex, setDragWeaponIndex] = useState<number | null>(null);
  const [damageInput, setDamageInput] = useState<string>("");
  const [unmitigatedDamage, setUnmitigatedDamage] = useState<boolean>(false);
  const logEntries = (props.combatLog ?? []).slice(-3).reverse();


  const learnedInfoById = useMemo(() => makeLearnedInfoById(), []);

  const allSkills: SkillDef[] = useMemo(() => {
    const learned = Object.values(skillsData.learned).flat();
    return [...skillsData.inherent, ...learned];
  }, []);

  const WEAPON_SKILL_IDS = new Set([
    "melee_weapons",
    "melee_unarmed",
    "weapons_light",
    "weapons_medium",
    "weapons_heavy",
    "weapons_exotic",
    "explosives",
  ]);
  const weaponSkillOptions = allSkills.filter((s) => WEAPON_SKILL_IDS.has(s.id));

  const skillOptions = useMemo(() => {
    return [...allSkills].sort((a, b) => a.label.localeCompare(b.label));
  }, [allSkills]);

  // Initiative is handled from the Initiative tab.



function applyDamage() {
  const raw = Number(damageInput);
  const incoming = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
  if (incoming <= 0) return;

  const result = applyDamageAndStress({
    sheet: props.sheet,
    incomingDamage: incoming,
    unmitigated: unmitigatedDamage,
  });

  props.onChange({
    wounds: result.sheet.wounds as any,
    armor: result.sheet.armor as any,
    stress: result.sheet.stress as any,
  });

  if (result.stressDelta > 0 && props.onApplyStress) {
    props.onApplyStress(result.sheet.stress?.current ?? 0);
  }

  setDamageInput("");
}
  function skillModifier(skillId: string): number {
    return skillModifierFor({
      learnedInfoById,
      sheet: s,
      skillId,
      skillMods: props.skillMods,
    });
  }

function updateWeapon(i: number, patch: Partial<CharacterSheetV1["weapons"][number]>) {
    const next = [...(s.weapons ?? [])];
    const prev = next[i];

    // If this is a custom weapon and ammoMax isn't set yet, treat the first entered ammo value as its max.
    if (patch.ammo !== undefined) {
      const currentMax = getAmmoMax(prev);
      if (!currentMax && patch.ammo > 0) {
        const mergedParams = { ...(prev.keywordParams ?? {}), ammoMax: patch.ammo };
        next[i] = { ...prev, ...patch, keywordParams: mergedParams };
        props.onChange({ weapons: next });
        return;
      }
    }

    next[i] = { ...prev, ...patch };
    props.onChange({ weapons: next });
  }

  function moveWeapon(from: number | null, to: number) {
    if (from === null || from === to) return;
    const cur = props.sheet.weapons ?? [];
    if (from < 0 || from >= cur.length || to < 0 || to >= cur.length) return;
    const next = [...cur];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    props.onChange({ weapons: next });
    setDragWeaponIndex(to);
  }

  function addWeaponByTemplateId(templateId: string) {
    const t = WEAPON_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;

    const next = [...(s.weapons ?? [])];
    next.push({
      name: t.name,
      skillId: t.skillId,
      useDC: t.useDC,
      damage: t.damage,
      range: t.range,
      ammo: t.ammo,
      bulk: t.bulk,
      req: t.req,
      cost: t.cost,
      keywords: [...(t.keywords ?? [])],
      keywordParams: { ammoMax: t.ammo ?? 0, ...(t.keywordParams ?? {}) }
    });
    props.onChange({ weapons: next });
  }


  function addCustomWeapon() {
    const next = [...(s.weapons ?? [])];
    next.push({
      name: "New Weapon",
      skillId: "weapons_medium",
      useDC: 8,
      damage: 3,
      range: "Med",
      ammo: 0,
      bulk: 1,
      req: "",
      cost: 0,
      keywords: [],
      keywordParams: { ammoMax: 0 }
    });
    props.onChange({ weapons: next });
  }


  function removeWeapon(i: number) {
    const next = [...(s.weapons ?? [])];
    next.splice(i, 1);
    props.onChange({ weapons: next });
  }


  async function rollWeaponAttack(i: number, w: CharacterSheetV1["weapons"][number]) {
    const maxAmmo = getAmmoMax(w);
    const currentAmmo = Number.isFinite(w.ammo as any) ? Number(w.ammo) : 0;

    if (maxAmmo > 0 && currentAmmo <= 0) {
      // Hard stop: ranged weapons shouldn't fire at 0 ammo.
      void OBR.notification.show("Out of ammo. Reload first.", "WARNING");
      return;
    }

    const mod = skillModifier(w.skillId);
    await rollWeaponAttackAndBroadcast({
      weapon: w as any,
      useDC: Number.isFinite(w.useDC as any) ? Number(w.useDC) : 0,
      netDice,
      modifier: mod,
      attackerName: props.sheet.name,
      rollTarget: "everyone",
      showResults: true,
    });

    // Spend ammo for weapons that track it.
    if (maxAmmo > 0) {
      updateWeapon(i, { ammo: Math.max(0, currentAmmo - 1) });
    }
  }

  const [weaponPrefab, setWeaponPrefab] = useState<string>("");
  const [armorPrefab, setArmorPrefab] = useState<string>("");

  function setArmorByTemplateId(templateId: string) {
    const t = ARMOR_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;

    props.onChange({
      armor: {
        name: t.name,
        keywords: [...(t.keywords ?? [])],
        keywordParams: { ...(t.keywordParams ?? {}) },
        protection: t.protection,
        durability: { current: t.durability, max: t.durability },
        bulk: t.bulk,
        req: t.req,
        cost: t.cost,
        special: t.special
      }
    });
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ m: 0 }}>Combat</Typography>

      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Take Damage:</Typography>
  <TextField
    size="small"
    type="number"
    inputProps={{ min: 0 }}
    value={damageInput}
    onChange={(e) => setDamageInput(e.target.value)}
    sx={{ width: 90 }}
  />
  <ToggleButton
    size="small"
    value="unmitigated"
    selected={unmitigatedDamage}
    onChange={() => setUnmitigatedDamage((v) => !v)}
  >
    Unmitigated
  </ToggleButton>
  <Button size="small" variant="outlined" onClick={applyDamage}>
    Apply
  </Button>

      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Attack Roll:</Typography>
        <ToggleButtonGroup
            size="small"
            exclusive
            value={netDice}
            onChange={(_, v) => {
              if (v === null) return;
              setNetDice(v);
            }}
          >
            <ToggleButton value={-2}>−2</ToggleButton>
            <ToggleButton value={-1}>−1</ToggleButton>
            <ToggleButton value={0}>0</ToggleButton>
            <ToggleButton value={1}>+1</ToggleButton>
            <ToggleButton value={2}>+2</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <CombatLog entries={logEntries} onApply={props.onApplyCombatLog} />

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700}>Weapons</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                label="Add prefab weapon"
                size="small"
                select
                value={weaponPrefab}
                onChange={(e) => setWeaponPrefab(e.target.value)}
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">— choose —</MenuItem>
                {WEAPON_TEMPLATES.map((w) => (
                  <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
                ))}
              </TextField>

              <IconButton
                color="primary"
                onClick={() => addWeaponByTemplateId(weaponPrefab)}
                aria-label="Add prefab weapon"
                disabled={!weaponPrefab}
              >
                <AddIcon />
              </IconButton>

              <Box sx={{ flex: 1 }} />

              <IconButton color="primary" onClick={addCustomWeapon} aria-label="Add custom weapon">
                <AddIcon />
              </IconButton>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>Add custom weapon</Typography>
            </Box>

            {(s.weapons ?? []).length === 0 ? (
              <Typography sx={{ opacity: 0.75 }}>No weapons yet.</Typography>
            ) : (
              (s.weapons ?? []).map((w, i) => (
                <Box
                  key={w.id ?? `${w.name}-${i}`}
                  draggable
                  onDragStart={() => setDragWeaponIndex(i)}
                  onDragEnd={() => setDragWeaponIndex(null)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); moveWeapon(dragWeaponIndex, i); }}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1.25,
                    cursor: "grab",
                    opacity: dragWeaponIndex === i ? 0.85 : 1,
                    display: "grid",
                    gap: 1.25
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <TextField
                      label="Name"
                      size="small"
                      value={w.name}
                      onChange={(e) => updateWeapon(i, { name: e.target.value })}
                      fullWidth
                    />

                    <Tooltip title="Roll attack with Dice+">
                      <IconButton onClick={() => rollWeaponAttack(i, w)} aria-label={`Roll attack for ${w.name}`}>
                        <CasinoIcon />
                      </IconButton>
                    </Tooltip>

                    <IconButton onClick={() => removeWeapon(i)} aria-label="Remove weapon">
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1 }}>
                    <TextField
                      label="Skill"
                      size="small"
                      select
                      value={w.skillId}
                      onChange={(e) => updateWeapon(i, { skillId: e.target.value })}
                    >
                      {weaponSkillOptions.map((sk) => (
                        <MenuItem key={sk.id} value={sk.id}>{sk.label}</MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Use DC"
                      size="small"
                      type="number"
                      value={w.useDC}
                      onChange={(e) => updateWeapon(i, { useDC: Number(e.target.value) })}
                    />

                    <TextField
                      label="Damage"
                      size="small"
                      type="number"
                      value={w.damage}
                      onChange={(e) => updateWeapon(i, { damage: Number(e.target.value) })}
                    />

                    <TextField
                      label="Range"
                      size="small"
                      value={w.range ?? ""}
                      onChange={(e) => updateWeapon(i, { range: e.target.value })}
                      placeholder="Melee / Short / Med / Long"
                    />

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField
                      label="Ammo"
                      size="small"
                      type="number"
                      value={w.ammo ?? 0}
                      onChange={(e) => updateWeapon(i, { ammo: Number(e.target.value) })}
                      sx={{ width: 110 }}
                    />
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      / {getAmmoMax(w) || 0}
                    </Typography>
                    <Tooltip title="Reload">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => updateWeapon(i, { ammo: getAmmoMax(w) || 0 })}
                          disabled={(getAmmoMax(w) || 0) <= 0}
                        >
                          <ReplayIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>

                  <TextField
                      label="Bulk"
                      size="small"
                      type="number"
                      value={w.bulk ?? 0}
                      onChange={(e) => updateWeapon(i, { bulk: Number(e.target.value) })}
                    />

                    <TextField
                      label="Req."
                      size="small"
                      value={w.req ?? ""}
                      onChange={(e) => updateWeapon(i, { req: e.target.value })}
                      placeholder="PHYS 1 / REF 2 / etc"
                    />
                    <TextField
                      label="Keywords (comma)"
                      size="small"
                      value={(w.keywords ?? []).join(", ")}
                      onChange={(e) =>
                        updateWeapon(i, {
                          keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean)
                        })
                      }
                      placeholder="Two-Handed, Piercing 1"
                      sx={{ gridColumn: "1 / -1" }}
                    />
                    {(w.keywords ?? []).length > 0 && (
                      <Box sx={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {(w.keywords ?? []).map((kw, kidx) => {
                          const info = resolveWeaponKeyword(kw);
                          if (!info) {
                            return <Chip key={`${kw}-${kidx}`} label={kw} size="small" variant="outlined" />;
                          }
                          return (
                            <Tooltip key={`${kw}-${kidx}`} title={info.description}>
                              <span>
                                <Chip label={kw} size="small" variant="outlined" />
                              </span>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700}>Armor</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField
                label="Set prefab armor"
                size="small"
                select
                value={armorPrefab}
                onChange={(e) => setArmorPrefab(e.target.value)}
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">— choose —</MenuItem>
                {ARMOR_TEMPLATES.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                ))}
              </TextField>

              <IconButton
                color="primary"
                onClick={() => setArmorByTemplateId(armorPrefab)}
                aria-label="Set prefab armor"
                disabled={!armorPrefab}
              >
                <AddIcon />
              </IconButton>
            </Box>

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 1 }}>
                <TextField
                  label="Name"
                  size="small"
                  value={s.armor?.name ?? ""}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? {
                          durability: { current: 0, max: 0 },
                          protection: 0,
                          keywords: [],
                          keywordParams: { ammoMax: 0 }
                        }),
                        name: e.target.value
                      }
                    })
                  }
                />

                <TextField
                  label="Protection"
                  size="small"
                  type="number"
                  value={s.armor?.protection ?? 0}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? { name: "", durability: { current: 0, max: 0 }, keywords: [], keywordParams: {} }),
                        protection: Number(e.target.value)
                      }
                    })
                  }
                />

                <TextField
                  label="Durability (cur)"
                  size="small"
                  type="number"
                  value={s.armor?.durability.current ?? 0}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? { name: "", durability: { current: 0, max: 0 }, protection: 0, keywords: [], keywordParams: {} }),
                        durability: { ...(s.armor?.durability ?? { current: 0, max: 0 }), current: Number(e.target.value) }
                      }
                    })
                  }
                />

                <TextField
                  label="Durability (max)"
                  size="small"
                  type="number"
                  value={s.armor?.durability.max ?? 0}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? { name: "", durability: { current: 0, max: 0 }, protection: 0, keywords: [], keywordParams: {} }),
                        durability: { ...(s.armor?.durability ?? { current: 0, max: 0 }), max: Number(e.target.value) }
                      }
                    })
                  }
                />
              </Box>

			  {(s.armor?.durability?.max ?? 0) > 0 && (s.armor?.durability?.current ?? 0) <= 0 && (
			    <Typography sx={{ mt: 1 }} color="error" variant="body2">
			      Broken: armor provides no Protection until repaired.
			    </Typography>
			  )}

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 1, mt: 1 }}>
                <TextField
                  label="Bulk"
                  size="small"
                  type="number"
                  value={(s.armor as any)?.bulk ?? 0}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? { name: "", durability: { current: 0, max: 0 }, protection: 0, keywords: [], keywordParams: {} }),
                        bulk: Number(e.target.value)
                      } as any
                    })
                  }
                />
                <TextField
                  label="Req."
                  size="small"
                  value={(s.armor as any)?.req ?? ""}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? { name: "", durability: { current: 0, max: 0 }, protection: 0, keywords: [], keywordParams: {} }),
                        req: e.target.value
                      } as any
                    })
                  }
                />
                <TextField
                  label="Special"
                  size="small"
                  value={(s.armor as any)?.special ?? ""}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? { name: "", durability: { current: 0, max: 0 }, protection: 0, keywords: [], keywordParams: {} }),
                        special: e.target.value
                      } as any
                    })
                  }
                />
              </Box>

              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Keywords (comma)"
                  size="small"
                  fullWidth
                  value={(s.armor?.keywords ?? []).join(", ")}
                  onChange={(e) =>
                    props.onChange({
                      armor: {
                        ...(s.armor ?? { name: "", durability: { current: 0, max: 0 }, protection: 0, keywords: [], keywordParams: {} }),
                        keywords: e.target.value.split(",").map((x) => x.trim()).filter(Boolean)
                      }
                    })
                  }
                  placeholder="Frontal Shielding 1"
                />
              </Box>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
