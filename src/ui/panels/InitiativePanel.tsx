import React, { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

import { CharacterSheetV1 } from "../../rules/schema";
import {
  advanceInitiative,
  clearInitiative,
  onInitiativeChange,
  removeInitiativeEntry,
  setSurprised,
  upsertInitiativeEntry,
} from "../../obr/initiative";
import type { InitiativeTrackerState } from "../../obr/initiative";
import { getMyCharacterTokenId, loadSheetFromToken, saveSheetToToken, TOKEN_KEY_OWNER_PLAYER } from "../../obr/metadata";
import { skillsData } from "../../data/skills";
import type { FocusId } from "../../data/types";
import { deriveAttributesFromSkills, deriveCUFFromSkills } from "../../rules/deriveAttributes";
import { applyStatusToDerived, computeStatusEffects } from "../../rules/statusEffects";
import { buildWhisperspaceSkillNotation, rollWithDicePlusTotal } from "../diceplus/roll";
import { rollWeaponAttackAndBroadcast } from "../combat/weaponAttack";

import {
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import Avatar from "@mui/material/Avatar";
import DeleteIcon from "@mui/icons-material/Delete";
import CasinoIcon from "@mui/icons-material/Casino";
import ShieldIcon from "@mui/icons-material/Shield";
import ReplayIcon from "@mui/icons-material/Replay";

type TokenExtra = {
  tokenId: string;
  name: string;
  thumbUrl?: string;
  ownerPlayerId?: string;
  prot: number;
  armorBroken: boolean;
  topWeaponName?: string;
  topWeaponUseDC?: number;
  topWeaponDamage?: number;
  topWeaponSkillId?: string;
  topWeaponAmmo?: number;
  topWeaponAmmoMax?: number;
};

function makeLearnedInfoById() {
  const map = new Map<string, { focus: FocusId }>();
  (Object.keys(skillsData.learned) as FocusId[]).forEach((focus) => {
    (skillsData.learned[focus] ?? []).forEach((s) => map.set(s.id, { focus }));
  });
  return map;
}

function getAmmoMax(w: CharacterSheetV1["weapons"][number] | undefined): number {
  if (!w) return 0;
  const raw = (w.keywordParams as any)?.ammoMax;
  const max = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : undefined;
  return Number.isFinite(max) ? Number(max) : 0;
}

function skillModifierFor(
  learnedInfoById: Map<string, { focus: FocusId }>,
  skillId: string,
  learningFocus: FocusId,
  rank: number,
  bonus: number
): number {
  if (rank > 0) return rank + bonus;
  const learnedInfo = learnedInfoById.get(skillId);
  const base = learnedInfo && learnedInfo.focus === learningFocus ? 0 : -1;
  return base + bonus;
}

export function InitiativePanel() {
  // Local initial state until we receive the shared initiative state from OBR metadata.
  const [state, setState] = useState<InitiativeTrackerState>({
    entries: [],
    activeTokenId: undefined,
    updatedAt: Date.now(),
  });
  const [tokenExtras, setTokenExtras] = useState<Record<string, TokenExtra>>({});
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [isGM, setIsGM] = useState(false);

  // Attack dice controls for the initiative-row "Attack" button.
  const [netDice, setNetDice] = useState<-2 | -1 | 0 | 1 | 2>(0);

  const clampNetDice = (n: number) => Math.max(-3, Math.min(3, n));
  const learnedInfoById = useMemo(() => makeLearnedInfoById(), []);

  useEffect(() => {
    const off = onInitiativeChange((s) => setState(s));
    return () => off?.();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [id, role] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (OBR.player as any).getId?.() ?? Promise.resolve(""),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (OBR.player as any).getRole?.() ?? Promise.resolve(""),
        ]);
        if (!mounted) return;
        setMyPlayerId(String(id ?? ""));
        setIsGM(String(role).toUpperCase() === "GM");
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const sorted = useMemo(() => {
    const arr = [...(state.entries ?? [])];
    arr.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
    return arr;
  }, [state.entries]);

  // Fetch token details (name, thumb, owner, prot, top weapon) for display and actions
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ids = sorted.map((e) => e.tokenId);
        if (!ids.length) {
          if (mounted) setTokenExtras({});
          return;
        }
        const items = await OBR.scene.items.getItems(ids);
        const next: Record<string, TokenExtra> = {};

        for (const it of items) {
          const tokenId = it.id;
          const sheet = await loadSheetFromToken(tokenId);
          const armor = sheet?.armor;
          const durabilityCur = armor?.durability?.current ?? 0;
          const armorBroken = !!armor && durabilityCur <= 0;
          const prot = armorBroken ? 0 : (armor?.protection ?? 0);
          const w0 = sheet?.weapons?.[0];
          const ammoMax = getAmmoMax(w0);
          const ammoCur = Number.isFinite(w0?.ammo as any) ? Number(w0?.ammo) : 0;
          next[tokenId] = {
            tokenId,
            name:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (it as any).text?.plainText?.trim?.() || sheet?.name || "(Unnamed)",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            thumbUrl: (it as any).image?.url,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ownerPlayerId: String(((it as any).metadata?.[TOKEN_KEY_OWNER_PLAYER] as any) ?? ""),
            prot,
            armorBroken,
            topWeaponName: w0?.name,
            topWeaponUseDC: w0?.useDC,
            topWeaponDamage: w0?.damage,
            topWeaponSkillId: w0?.skillId,
            topWeaponAmmo: ammoCur,
            topWeaponAmmoMax: ammoMax,
          };
        }

        if (mounted) setTokenExtras(next);
      } catch {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, [sorted]);

  async function rollInitiativeForToken(tokenId: string) {
    const [item] = await OBR.scene.items.getItems([tokenId]);
    if (!item) return;

    const sheet = await loadSheetFromToken(tokenId);
    if (!sheet) return;

    const deltas = computeStatusEffects([
      ...(sheet.feats ?? []).map((f) => f.statusEffects ?? "").filter(Boolean),
      ...(sheet.inventory ?? []).map((i) => i.statusEffects ?? "").filter(Boolean),
    ]).deltas;

    const baseAttrs = deriveAttributesFromSkills(sheet.skills ?? {});
    const curStress = sheet.stress?.current ?? 0;
    const baseCUF = Math.max(0, (deriveCUFFromSkills(sheet.skills ?? {}) || 0) - (sheet.stress?.cufLoss ?? 0));
    const derived = applyStatusToDerived(
      {
        attributes: baseAttrs,
        stress: { current: curStress, cuf: baseCUF },
      },
      deltas
    );

    const effectiveCUF = derived.stress.cuf ?? baseCUF;
    const effectiveRef = derived.attributes.ref ?? baseAttrs.ref ?? 0;

    const stressed = curStress > effectiveCUF;
    const diceNotation = buildWhisperspaceSkillNotation({
      netDice: stressed ? -1 : 0,
      modifier: effectiveRef,
      label: `${(item as any).text?.plainText ?? sheet.name ?? "Token"} Initiative`,
    });

    const initiative = await rollWithDicePlusTotal({ diceNotation, rollTarget: "everyone", showResults: true });
    await upsertInitiativeEntry({
      tokenId,
      initiative,
      name: (item as any).text?.plainText ?? sheet.name ?? "Token",
      thumbUrl: (item as any).image?.url,
    });
  }

  async function rollInitiativeFromButton() {
    // Prefer selected token; fallback to "my character" token.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selection: string[] = (await (OBR.player as any).getSelection?.()) ?? [];
    const selectedId = selection?.[0];
    const myTokenId = (await getMyCharacterTokenId()) ?? undefined;
    const tokenId = selectedId || myTokenId;
    if (!tokenId) {
      OBR.notification.show("Select a token (or set your character) to roll initiative.", "WARNING");
      return;
    }
    await rollInitiativeForToken(tokenId);
  }

  async function attackWithTopWeapon(tokenId: string) {
    const sheet = await loadSheetFromToken(tokenId);
    if (!sheet) return;

    const weapon = sheet.weapons?.[0];
    if (!weapon) {
      OBR.notification.show("No weapon in the top slot.", "WARNING");
      return;
    }

    const deltas = computeStatusEffects([
      ...(sheet.feats ?? []).map((f) => f.statusEffects ?? "").filter(Boolean),
      ...(sheet.inventory ?? []).map((i) => i.statusEffects ?? "").filter(Boolean),
    ]).deltas;

    const baseCUF = (deriveCUFFromSkills(sheet.skills ?? {}) - (sheet.stress?.cufLoss ?? 0)) || 0;
    const effectiveCUF = baseCUF + (deltas["cool_under_fire"] ?? 0);
    const curStress = sheet.stress?.current ?? 0;
    const stressed = curStress > effectiveCUF;

    const skillId = String(weapon.skillId ?? "");
    const baseRank = sheet.skills?.[skillId] ?? 0;
    const learningFocus = (sheet.learningFocus ?? "combat") as FocusId;
    const mod = skillModifierFor(learnedInfoById, skillId, learningFocus, baseRank, deltas[skillId] ?? 0);

    const maxAmmo = getAmmoMax(weapon);
    const curAmmo = Number.isFinite((weapon as any)?.ammo) ? Number((weapon as any)?.ammo) : 0;
    if (maxAmmo > 0 && curAmmo <= 0) {
      void OBR.notification.show("Out of ammo. Reload first.", "WARNING");
      return;
    }

    const effectiveNetDice = clampNetDice(netDice - (stressed ? 1 : 0));

    // Use the same weapon attack roll + messaging as the Combat tab.
    await rollWeaponAttackAndBroadcast({
      weapon: weapon as any,
      netDice: effectiveNetDice,
      modifier: mod,
      rollTarget: "everyone",
      showResults: true,
    });

    // Spend ammo if applicable.
    if (maxAmmo > 0) {
      const nextAmmo = Math.max(0, curAmmo - 1);
      const nextWeapons = [...(sheet.weapons ?? [])];
      nextWeapons[0] = { ...nextWeapons[0], ammo: nextAmmo } as any;
      await saveSheetToToken(tokenId, { ...sheet, weapons: nextWeapons });
    }
  }

  async function reloadTopWeapon(tokenId: string) {
    const sheet = await loadSheetFromToken(tokenId);
    if (!sheet) return;
    const weapon = sheet.weapons?.[0];
    if (!weapon) return;
    const maxAmmo = getAmmoMax(weapon);
    if (maxAmmo <= 0) return;
    const nextWeapons = [...(sheet.weapons ?? [])];
    nextWeapons[0] = { ...nextWeapons[0], ammo: maxAmmo } as any;
    await saveSheetToToken(tokenId, { ...sheet, weapons: nextWeapons });
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ m: 0 }}>Initiative</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="contained" onClick={() => void rollInitiativeFromButton()} startIcon={<CasinoIcon />}
          >
            Roll Initiative
          </Button>

          {/* Attack dice controls (used by initiative-row Attack buttons) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pl: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Attack Roll:
            </Typography>
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

          {isGM && (
            <>
              <Button size="small" variant="outlined" onClick={() => clearInitiative()}>Clear</Button>
              <Button size="small" variant="outlined" onClick={() => advanceInitiative()}>Advance</Button>
            </>
          )}
        </Stack>
      </Box>

      <Divider />

      {sorted.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          No initiative rolls yet.
        </Typography>
      ) : (
        <List dense disablePadding>
          {sorted.map((e) => {
            const extra = tokenExtras[e.tokenId];
            const ownerId = extra?.ownerPlayerId;
            const canControlRow = isGM || (!!ownerId && ownerId === myPlayerId);
            const isActive = state.activeTokenId === e.tokenId;
            const showYourTurn = isActive && canControlRow && !isGM;
            const surprised = !!e.surprised;
            const ammoMax = extra?.topWeaponAmmoMax ?? 0;
            const ammoCur = extra?.topWeaponAmmo ?? 0;
            const outOfAmmo = ammoMax > 0 && ammoCur <= 0;

            return (
              <ListItem
                key={e.tokenId}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  opacity: surprised ? 0.55 : 1,
                }}
                secondaryAction={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title={extra?.armorBroken ? "Armor broken" : "Protection"}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: "rgba(0,0,0,0.25)" }}>
                        <ShieldIcon fontSize="small" sx={{ color: extra?.armorBroken ? "error.main" : "inherit" }} />
                        <Typography variant="caption">{extra?.prot ?? 0}</Typography>
                      </Box>
                    </Tooltip>

                    {(isGM || canControlRow) && (
                      <Tooltip
                        title={
                          !extra?.topWeaponName
                            ? "No top weapon"
                            : outOfAmmo
                              ? `Out of ammo: ${extra.topWeaponName}`
                              : `Attack: ${extra.topWeaponName}`
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            disabled={!extra?.topWeaponName || outOfAmmo}
                            onClick={() => void attackWithTopWeapon(e.tokenId)}
                          >
                            <CasinoIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                    {(isGM || canControlRow) && (
                      <Tooltip
                        title={
                          !extra?.topWeaponName
                            ? "No top weapon"
                            : ammoMax <= 0
                              ? "No ammo to reload"
                              : `Reload: ${extra.topWeaponName}`
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            disabled={!extra?.topWeaponName || ammoMax <= 0}
                            onClick={() => void reloadTopWeapon(e.tokenId)}
                          >
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                    <Tooltip title={canControlRow || isGM ? "Remove" : "Only the owner or GM can remove"}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canControlRow && !isGM}
                          onClick={() => removeInitiativeEntry(e.tokenId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    src={extra?.thumbUrl}
                    variant="rounded"
                    sx={{ width: 32, height: 32, mr: 1, cursor: "pointer" }}
                    // TODO: center/select token (SDK method differs by version)
                  />
                </ListItemAvatar>

                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {extra?.name ?? e.name ?? "Token"}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.75 }}>
                        {e.initiative}
                      </Typography>
                      {showYourTurn && (
                        <Typography variant="caption" sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: "rgba(0,128,255,0.2)" }}>
                          Your Turn
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Checkbox
                        size="small"
                        checked={surprised}
                        disabled={!isGM}
                        onChange={(ev) => setSurprised(e.tokenId, ev.target.checked)}
                      />
                      <Typography variant="caption" sx={{ opacity: 0.75 }}>
                        Surprised
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Stack>
  );
}
