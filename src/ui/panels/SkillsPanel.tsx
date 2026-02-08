import React, { useEffect, useMemo, useState } from "react";
import { CharacterSheetV1 } from "../../rules/schema";
import { skillsData } from "../../data/skills";
import type { AttributeId, FocusId, SkillDef } from "../../data/types";
import { Button } from "@mui/material";
import CasinoIcon from "@mui/icons-material/Casino";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  IconButton,
  Radio,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";

import { buildWhisperspaceSkillNotation, checkDicePlusReady, rollWithDicePlus } from "../diceplus/roll";
import { makeLearnedInfoById } from "../combat/skills";

const ATTR_ORDER: AttributeId[] = ["phys", "ref", "soc", "ment"];
const ATTR_LABEL: Record<AttributeId, string> = {
  phys: "PHYSIQUE",
  ref: "REFLEX",
  soc: "SOCIAL",
  ment: "MENTAL",
};

const FOCUS_SHORT: Record<FocusId, string> = {
  combat: "Combat",
  education: "Education",
  vehicles: "Vehicles",
};

const FOCUS_LABEL: Record<FocusId, string> = {
  combat: "Combat Focus",
  education: "Education Focus",
  vehicles: "Vehicles Focus",
};

type LearningFocusId = FocusId;

/** Total cost to reach a rank from 0: 0->0, 1->1, 2->3, 3->6, 4->10, 5->15 */
function costToReach(rank: number) {
  const r = clampInt(rank, 0, 5);
  return (r * (r + 1)) / 2;
}

export function SkillsPanel(props: {
  sheet: CharacterSheetV1;
  onChange: (skills: Record<string, number>) => void;
  onMetaChange: (patch: Partial<CharacterSheetV1>) => void;
  skillMods?: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const [netDice, setNetDice] = useState<-2 | -1 | 0 | 1 | 2>(0);
  const [diceReady, setDiceReady] = useState<boolean>(true);
  const [diceChecked, setDiceChecked] = useState<boolean>(false);
  const [spDelta, setSpDelta] = useState<string>("");

  const ranks = (props.sheet.skills ?? {}) as Record<string, number>;
  const learningFocus: LearningFocusId = (props.sheet.learningFocus ?? "combat") as LearningFocusId;
  const totalSkillPoints: number = Number(props.sheet.skillPoints ?? 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkDicePlusReady();
      if (!cancelled) {
        setDiceReady(ok);
        setDiceChecked(true);
      }
    })().catch(() => {
      if (!cancelled) {
        setDiceReady(false);
        setDiceChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const learnedInfoById = useMemo(() => makeLearnedInfoById(), []);

  function maxRankFor(skill: SkillDef): number {
    const learnedInfo = learnedInfoById.get(skill.id);
    if (!learnedInfo) return 5; // inherent
    return learnedInfo.focus === learningFocus ? 5 : 2;
  }

  function modifierFor(skill: SkillDef): number {
    const rank = ranks[skill.id] ?? 0;
    const bonus = props.skillMods?.[skill.id] ?? 0;
    if (rank > 0) return rank + bonus;

    const learnedInfo = learnedInfoById.get(skill.id);
    // Rank 0 learned skill in chosen focus uses 0 instead of -1
    if (learnedInfo && learnedInfo.focus === learningFocus) return 0 + bonus;
    return -1 + bonus;
  }

  const spentSkillPoints = useMemo(() => {
    let spent = 0;
    for (const rank of Object.values(ranks)) {
      spent += costToReach(rank ?? 0);
    }
    return spent;
  }, [ranks]);

  const remainingSkillPoints = Math.max(0, totalSkillPoints - spentSkillPoints);

  const applySkillPointDelta = (sign: 1 | -1) => {
    const amt = Math.max(0, Math.trunc(Number(spDelta)));
    if (!amt) return;
    const next = totalSkillPoints + sign * amt;
    // Don't allow total skill points to drop below already-spent points.
    const clamped = Math.max(spentSkillPoints, next);
    props.onMetaChange({ skillPoints: clamped });
    setSpDelta("");
  };

  function setSkills(next: Record<string, number>) {
    props.onChange(next);
  }

  function trySetRank(skill: SkillDef, nextRank: number) {
    const current = ranks[skill.id] ?? 0;
    const max = maxRankFor(skill);
    const target = clampInt(nextRank, 0, max);

    if (target === current) return;

    const deltaCost = costToReach(target) - costToReach(current);
    if (deltaCost > remainingSkillPoints) return;

    const next = { ...ranks };
    if (target === 0) delete next[skill.id];
    else next[skill.id] = target;

    setSkills(next);
  }

  async function rollSkill(skill: SkillDef) {
    const diceNotation = buildWhisperspaceSkillNotation({
      netDice,
      modifier: modifierFor(skill),
      label: skill.label,
    });

    try {
      await rollWithDicePlus({ diceNotation, showResults: true, rollTarget: "everyone" });
    } catch (e) {
      console.error("Dice+ roll request failed:", e);
    }
  }

  const allSkills = useMemo(() => {
    const learned = Object.values(skillsData.learned).flat();
    return [...skillsData.inherent, ...learned];
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSkills;
    return allSkills.filter((s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [allSkills, search]);

  const inherentByAttr = useMemo(() => groupByAttribute(skillsData.inherent), []);
  const learnedByFocus = useMemo(() => skillsData.learned, []);
  const isSearching = search.trim().length > 0;

  const focusSelector = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
      <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
        Learning Focus:
      </Typography>

      {(Object.keys(FOCUS_LABEL) as FocusId[]).map((f) => (
        <Box
          key={f}
          sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
          onClick={() => props.onMetaChange({ learningFocus: f })}
        >
          <Radio checked={learningFocus === f} value={f} size="small" />
          <Typography variant="body2">{FOCUS_SHORT[f]}</Typography>
        </Box>
      ))}
    </Box>
  );

  const topRow = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" sx={{ minWidth: 170 }}>
          Skill Points: {remainingSkillPoints} <span style={{ opacity: 0.75 }}>(Total: {totalSkillPoints})</span>
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => applySkillPointDelta(1)}
          disabled={!Number.isFinite(Number(spDelta)) || Math.trunc(Number(spDelta)) <= 0}
        >
          +
        </Button>
        <TextField
          label="SP"
          size="small"
          type="number"
          value={spDelta}
          onChange={(e) => setSpDelta(e.target.value)}
          sx={{ width: 110 }}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={() => applySkillPointDelta(-1)}
          disabled={!Number.isFinite(Number(spDelta)) || Math.trunc(Number(spDelta)) <= 0}
        >
          -
        </Button>


        <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
          Roll
        </Typography>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={netDice}
          onChange={(_, v) => {
            if (v === null) return;
            setNetDice(v);
          }}
          aria-label="Bonus / Penalty dice"
        >
          <ToggleButton value={-2}>−2</ToggleButton>
          <ToggleButton value={-1}>−1</ToggleButton>
          <ToggleButton value={0}>0</ToggleButton>
          <ToggleButton value={1}>+1</ToggleButton>
          <ToggleButton value={2}>+2</ToggleButton>
        </ToggleButtonGroup>

        {diceChecked && !diceReady && (
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            (Dice+ not detected)
          </Typography>
        )}
      </Box>


    </Box>
  );

  return (
    <Stack spacing={2}>
      {focusSelector}

      <TextField
        label="Search skills"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="stealth, weapons, navigation…"
        fullWidth
      />

      {topRow}

      {isSearching ? (
        <Stack spacing={1}>
          {filtered.map((s) => {
            const learnedInfo = learnedInfoById.get(s.id);
            const tag = learnedInfo ? FOCUS_SHORT[learnedInfo.focus] : ATTR_LABEL[s.attribute];
            return (
              <SkillRow
                key={s.id}
                skill={s}
                rank={ranks[s.id] ?? 0}
                modifier={modifierFor(s)}
                maxRank={maxRankFor(s)}
                onRank={(r) => trySetRank(s, r)}
                rightTag={tag}
                canRoll={diceReady}
                onRoll={() => rollSkill(s)}
              />
            );
          })}
        </Stack>
      ) : (
        <>
          <Typography variant="subtitle1">Inherent Skills</Typography>

          {ATTR_ORDER.map((attr) => (
            <Accordion key={attr} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={700}>{ATTR_LABEL[attr]}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {(inherentByAttr[attr] ?? []).map((s) => (
                    <SkillRow
                      key={s.id}
                      skill={s}
                      rank={ranks[s.id] ?? 0}
                      modifier={modifierFor(s)}
                      maxRank={maxRankFor(s)}
                      onRank={(r) => trySetRank(s, r)}
                      rightTag={ATTR_LABEL[s.attribute]}
                      canRoll={diceReady}
                      onRoll={() => rollSkill(s)}
                    />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}

          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Learned Skills
          </Typography>

          {(Object.keys(learnedByFocus) as FocusId[]).map((focus) => (
            <Accordion key={focus} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={700}>{FOCUS_LABEL[focus]}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {(learnedByFocus[focus] ?? []).map((s) => (
                    <SkillRow
                      key={s.id}
                      skill={s}
                      rank={ranks[s.id] ?? 0}
                      modifier={modifierFor(s)}
                      maxRank={maxRankFor(s)}
                      onRank={(r) => trySetRank(s, r)}
                      rightTag={FOCUS_SHORT[focus]}
                      canRoll={diceReady}
                      onRoll={() => rollSkill(s)}
                    />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
    </Stack>
  );
}

function SkillRow(props: {
  skill: SkillDef;
  rank: number;
  modifier: number;
  maxRank: number;
  onRank: (r: number) => void;
  rightTag?: string;
  canRoll: boolean;
  onRoll: () => void;
}) {
  const canInc = props.rank < props.maxRank;
  const canDec = props.rank > 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: 1,
        alignItems: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        px: 1.25,
        py: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={600} noWrap>
          {props.skill.label}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }} noWrap>
          {props.rightTag ?? ""}
        </Typography>
      </Box>

      <Box sx={{ width: 46, textAlign: "center" }}>
        <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
          Mod
        </Typography>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {props.modifier >= 0 ? `+${props.modifier}` : `${props.modifier}`}
        </Typography>
      </Box>

      <Box sx={{ width: 40, textAlign: "center" }}>
        <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
          Rank
        </Typography>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{props.rank}</Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", justifyContent: "flex-end" }}>
        <IconButton size="small" onClick={() => props.onRank(props.rank - 1)} aria-label="Decrease rank" disabled={!canDec}>
          <RemoveIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={() => props.onRank(props.rank + 1)} aria-label="Increase rank" disabled={!canInc}>
          <AddIcon fontSize="small" />
        </IconButton>

        <Box sx={{ width: 6 }} />

        <Tooltip title={props.canRoll ? "Roll with Dice+" : "Dice+ not detected"}>
          <span>
            <IconButton size="small" onClick={props.onRoll} aria-label={`Roll ${props.skill.label}`} disabled={!props.canRoll}>
              <CasinoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}

function groupByAttribute(skills: SkillDef[]) {
  return skills.reduce((acc, s) => {
    (acc[s.attribute] ??= []).push(s);
    return acc;
  }, {} as Record<AttributeId, SkillDef[]>);
}

function clampInt(n: number, min: number, max: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}
