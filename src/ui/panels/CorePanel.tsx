import React, { useMemo, useState } from "react";
import { CharacterSheetV1 } from "../../rules/schema";
import { Stack, Box, Typography, TextField, ToggleButtonGroup, ToggleButton, IconButton, Tooltip } from "@mui/material";
import CasinoIcon from "@mui/icons-material/Casino";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { rollWithDicePlus } from "../diceplus/roll";
import { calcSkillNotation } from "../../lib/calcApi";
import { getAttributeTooltip } from "../../data/skillTooltips";

type AttrKey = "phys" | "ref" | "soc" | "ment";

export function CorePanel(props: {
  sheet: CharacterSheetV1;
  onChange: (patch: Partial<CharacterSheetV1>) => void;
}) {
  const s = props.sheet;

  // separate roll modifiers for attribute checks, like Skills/Combat.
  const [netDice, setNetDice] = useState<-2 | -1 | 0 | 1 | 2>(0);

  const attrs = useMemo(() => s.attributes ?? { phys: 0, ref: 0, soc: 0, ment: 0 }, [s.attributes]);

  async function rollAttr(attr: AttrKey, label: string) {
    const modifier = Number((attrs as any)[attr] ?? 0);
    const diceNotation = (await calcSkillNotation({ netDice, modifier, label })).notation;
    await rollWithDicePlus({ diceNotation, showResults: true, rollTarget: "everyone" });
  }

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ m: 0 }}>Core</Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Attribute Roll:</Typography>
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
      </Box>

      <TextField
        label="Name"
        size="small"
        value={s.name ?? ""}
        onChange={(e) => props.onChange({ name: e.target.value })}
        fullWidth
      />

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <AttrField label="PHYS" tooltip={getAttributeTooltip("PHYS")} value={attrs.phys} onRoll={() => rollAttr("phys", "PHYS Check")} />
        <AttrField label="REF" tooltip={getAttributeTooltip("REF")} value={attrs.ref} onRoll={() => rollAttr("ref", "REF Check")} />
        <AttrField label="SOC" tooltip={getAttributeTooltip("SOC")} value={attrs.soc} onRoll={() => rollAttr("soc", "SOC Check")} />
        <AttrField label="MENT" tooltip={getAttributeTooltip("MENT")} value={attrs.ment} onRoll={() => rollAttr("ment", "MENT Check")} />
      </Box>

      
<Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
  <TextField
    label="Cool Under Fire"
    size="small"
    value={props.sheet.stress?.cuf ?? 0}
    inputProps={{ readOnly: true }}
    fullWidth
  />
  <TextField
    label="Speed"
    size="small"
    value={30 + (attrs.phys ?? 0) * 5}
    inputProps={{ readOnly: true }}
    fullWidth
  />
  <TextField
    label="Carrying Capacity"
    size="small"
    value={5 + (attrs.phys ?? 0) * 5}
    inputProps={{ readOnly: true }}
    fullWidth
  />
</Box>

<Typography variant="body2" sx={{ opacity: 0.75 }}>
        Attributes are derived automatically from skill ranks (¼ of total ranks under each attribute, rounded up).
      </Typography>
    </Stack>
  );
}

function AttrField(props: { label: string; tooltip?: string; value: number; onRoll: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
        <TextField
          label={props.label}
          size="small"
          value={props.value}
          inputProps={{ readOnly: true }}
          fullWidth
        />
        {props.tooltip ? (
          <Tooltip title={props.tooltip}>
            <InfoOutlinedIcon fontSize="small" sx={{ opacity: 0.7 }} />
          </Tooltip>
        ) : null}
      </Box>
      <Tooltip title="Roll with Dice+">
        <IconButton onClick={props.onRoll} aria-label={`Roll ${props.label}`}>
          <CasinoIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
