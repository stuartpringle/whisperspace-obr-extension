import React, { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import type { CharacterSheetV1 } from "../../rules/schema";
import { ITEM_TEMPLATES } from "../../data/items";
import { CYBERWARE_TEMPLATES } from "../../data/cyberware";
import { NARCOTICS_TEMPLATES } from "../../data/narcotics";

type InvType = "item" | "cyberware" | "narcotics";

type InventoryPanelProps = {
  sheet: CharacterSheetV1;
  onChange: (next: Partial<CharacterSheetV1>) => void;
};

function uid() {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function InventoryPanel(props: InventoryPanelProps) {
  const inv = props.sheet.inventory ?? [];

  const updateInventory = (next: CharacterSheetV1["inventory"]) => {
    props.onChange({ inventory: next });
  };

  const [addType, setAddType] = useState<InvType>("item");
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const templates = useMemo(() => {
    if (addType === "item") return ITEM_TEMPLATES.map((t) => ({ type: "item" as const, ...t }));
    if (addType === "cyberware") return CYBERWARE_TEMPLATES.map((t) => ({ type: "cyberware" as const, ...t }));
    return NARCOTICS_TEMPLATES.map((t) => ({ type: "narcotics" as const, ...t }));
  }, [addType]);

  function applyTemplate(name: string | null) {
    setTemplateName(name);
    const t = templates.find((x) => x.name === name);
    if (!t) {
      setDraft({ type: addType, name: "", quantity: 1, bulk: addType === "item" ? 0 : 1, effect: "", cost: 0, statusEffects: "" });
      return;
    }

    if (addType === "item") {
      setDraft({
        type: "item",
        name: t.name,
        quantity: 1,
        uses: (t as any).uses ?? "",
        bulk: (t as any).bulk ?? 0,
        effect: (t as any).effect ?? "",
        cost: (t as any).cost ?? 0,
        statusEffects: (t as any).statusEffects ?? "",
      });
    } else if (addType === "cyberware") {
      setDraft({
        type: "cyberware",
        name: t.name,
        quantity: 1,
        bulk: (t as any).bulk ?? 1,
        tier: (t as any).tier ?? 1,
        installationDifficulty: (t as any).installationDifficulty ?? 0,
        requirements: (t as any).requirements ?? "",
        physicalImpact: (t as any).physicalImpact ?? "",
        effect: (t as any).effect ?? "",
        cost: (t as any).cost ?? 0,
        statusEffects: (t as any).statusEffects ?? "",
      });
    } else {
      setDraft({
        type: "narcotics",
        name: t.name,
        quantity: 1,
        bulk: (t as any).bulk ?? 1,
        uses: (t as any).uses ?? 1,
        addictionScore: (t as any).addictionScore ?? 0,
        legality: (t as any).legality ?? "",
        effect: (t as any).effect ?? "",
        cost: (t as any).cost ?? 0,
        statusEffects: (t as any).statusEffects ?? "",
      });
    }
  }

  function addItem() {
    const next = [...inv, { id: uid(), ...draft }];
    props.onChange({ inventory: next });
    // reset
    setTemplateName(null);
    setDraft({ type: addType, name: "", quantity: 1, bulk: addType === "item" ? 0 : 1, effect: "", cost: 0, statusEffects: "" });
  }

  function removeItem(id: string) {
    props.onChange({ inventory: inv.filter((x: any) => x.id !== id) });
  }

  function updateItem(id: string, patch: any) {
    props.onChange({ inventory: inv.map((x: any) => (x.id === id ? { ...x, ...patch } : x)) });
  }

  return (
    <Stack spacing={2}>
      <TextField
        label="Credits"
        type="number"
        value={props.sheet.credits ?? 0}
        onChange={(e) => props.onChange({ credits: Number(e.target.value) })}
        size="small"
      />

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Add Inventory
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          <TextField
            select
            size="small"
            label="Type"
            value={addType}
            onChange={(e) => {
              const t = e.target.value as InvType;
              setAddType(t);
              setTemplateName(null);
              if (t === "item") {
                setDraft({ type: t, name: "", quantity: 1, bulk: 0, uses: "", effect: "", cost: 0, statusEffects: "" });
              } else if (t === "cyberware") {
                setDraft({
                  type: t,
                  name: "",
                  quantity: 1,
                  bulk: 1,
                  tier: 1,
                  installationDifficulty: 0,
                  requirements: "",
                  physicalImpact: "",
                  effect: "",
                  cost: 0,
                  statusEffects: "",
                });
              } else {
                setDraft({
                  type: t,
                  name: "",
                  quantity: 1,
                  bulk: 1,
                  uses: 1,
                  addictionScore: 0,
                  legality: "",
                  effect: "",
                  cost: 0,
                  statusEffects: "",
                });
              }
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="item">Item</MenuItem>
            <MenuItem value="cyberware">Cyberware</MenuItem>
            <MenuItem value="narcotics">Narcotics</MenuItem>
          </TextField>

          <Autocomplete
            size="small"
            sx={{ flex: 1, minWidth: 220 }}
            options={templates.map((t) => t.name)}
            value={templateName}
            onChange={(_, v) => applyTemplate(v)}
            renderInput={(params) => <TextField {...params} label="Template (optional)" />}
          />

          <Button variant="contained" startIcon={<AddIcon />} onClick={addItem} disabled={!draft?.name}>
            Add
          </Button>
        </Stack>

        <Box sx={{ mt: 1 }}>
          <Stack spacing={1}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                label="Name"
                value={draft?.name ?? ""}
                onChange={(e) => setDraft((d: any) => ({ ...d, name: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                type="number"
                label="Bulk"
                value={draft?.bulk ?? 0}
                onChange={(e) => setDraft((d: any) => ({ ...d, bulk: Number(e.target.value) }))}
                sx={{ width: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="Quantity"
                value={draft?.quantity ?? 1}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setDraft((d: any) => ({ ...d, quantity: next }));
                }}
                sx={{ width: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="Cost"
                value={draft?.cost ?? 0}
                onChange={(e) => setDraft((d: any) => ({ ...d, cost: Number(e.target.value) }))}
                sx={{ width: 140 }}
              />
            </Stack>

            {addType === "item" && (
              <TextField
                size="small"
                label="Uses"
                value={draft?.uses ?? ""}
                onChange={(e) => setDraft((d: any) => ({ ...d, uses: e.target.value }))}
              />
            )}

            {addType === "cyberware" && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  type="number"
                  label="Tier"
                  value={draft?.tier ?? 1}
                  onChange={(e) => setDraft((d: any) => ({ ...d, tier: Number(e.target.value) }))}
                  sx={{ width: 120 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Installation Difficulty"
                  value={draft?.installationDifficulty ?? 0}
                  onChange={(e) => setDraft((d: any) => ({ ...d, installationDifficulty: Number(e.target.value) }))}
                  sx={{ width: 220 }}
                />
                <TextField
                  size="small"
                  label="Requirements"
                  value={draft?.requirements ?? ""}
                  onChange={(e) => setDraft((d: any) => ({ ...d, requirements: e.target.value }))}
                  sx={{ flex: 1 }}
                />
              </Stack>
            )}

            {addType === "cyberware" && (
              <TextField
                size="small"
                label="Physical Impact"
                value={draft?.physicalImpact ?? ""}
                onChange={(e) => setDraft((d: any) => ({ ...d, physicalImpact: e.target.value }))}
              />
            )}

            {addType === "narcotics" && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  type="number"
                  label="Uses"
                  value={draft?.uses ?? 1}
                  onChange={(e) => setDraft((d: any) => ({ ...d, uses: Number(e.target.value) }))}
                  sx={{ width: 120 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Addiction Score"
                  value={draft?.addictionScore ?? 0}
                  onChange={(e) => setDraft((d: any) => ({ ...d, addictionScore: Number(e.target.value) }))}
                  sx={{ width: 160 }}
                />
                <TextField
                  size="small"
                  label="Legality"
                  value={draft?.legality ?? ""}
                  onChange={(e) => setDraft((d: any) => ({ ...d, legality: e.target.value }))}
                  sx={{ flex: 1 }}
                />
              </Stack>
            )}

            <TextField
              size="small"
              label="Effect"
              value={draft?.effect ?? ""}
              onChange={(e) => setDraft((d: any) => ({ ...d, effect: e.target.value }))}
              multiline
              minRows={2}
            />

            <TextField
              size="small"
              label="Status Effects (comma-separated)"
              value={draft?.statusEffects ?? ""}
              onChange={(e) => setDraft((d: any) => ({ ...d, statusEffects: e.target.value }))}
              placeholder='e.g. "carrying_capacity+5"'
            />
          </Stack>
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Inventory
        </Typography>

        {inv.length === 0 && <Typography variant="body2">No inventory items yet.</Typography>}

        {inv.map((it: any) => {
          const qty = (it.quantity ?? 1) as number;
          const bulkEach = (it.bulk ?? 0) as number;
          const bulkTotal = bulkEach * qty;
          const common = `${it.name} (${it.type}) • bulk ${bulkTotal}`;
          return (
            <Accordion key={it.id} disableGutters>
              <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            draggable
            onDragStart={(e) => {
              setDragId(it.id ?? null);
              try {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", it.id ?? "");
              } catch {}
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverId(it.id ?? null);
            }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragId ?? e.dataTransfer.getData("text/plain");
              const to = it.id;
              if (from && to && from !== to) {
                const cur = props.sheet.inventory ?? [];
                const fromIdx = cur.findIndex((x: any) => x.id === from);
                const toIdx = cur.findIndex((x: any) => x.id === to);
                if (fromIdx >= 0 && toIdx >= 0) {
                  const next = [...cur];
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(toIdx, 0, moved);
                  updateInventory(next);
                }
              }
              setDragId(null);
              setDragOverId(null);
            }}
            sx={dragOverId === it.id ? { outline: "2px dashed rgba(255,255,255,0.35)", borderRadius: 1 } : undefined}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
              <DragIndicatorIcon fontSize="small" sx={{ opacity: 0.5 }} />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {common}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    const q = (it.quantity ?? 1) - 1;
                    if (q <= 0) removeItem(it.id);
                    else updateItem(it.id, { quantity: q });
                  }}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" sx={{ minWidth: 18, textAlign: "center" }}>
                  {it.quantity ?? 1}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateItem(it.id, { quantity: (it.quantity ?? 1) + 1 });
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Tooltip title="Remove">
                <IconButton size="small" onClick={(e) => (e.stopPropagation(), removeItem(it.id))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      label="Name"
                      value={it.name ?? ""}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      select
                      size="small"
                      label="Type"
                      value={it.type}
                      onChange={(e) => updateItem(it.id, { type: e.target.value })}
                      sx={{ width: 160 }}
                    >
                      <MenuItem value="item">Item</MenuItem>
                      <MenuItem value="cyberware">Cyberware</MenuItem>
                      <MenuItem value="narcotics">Narcotics</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      type="number"
                      label="Bulk"
                      value={it.bulk ?? 0}
                      onChange={(e) => updateItem(it.id, { bulk: Number(e.target.value) })}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Quantity"
                      value={it.quantity ?? 1}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isFinite(next)) return;
                        if (next <= 0) removeItem(it.id);
                        else updateItem(it.id, { quantity: next });
                      }}
                      sx={{ width: 120 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Cost"
                      value={it.cost ?? 0}
                      onChange={(e) => updateItem(it.id, { cost: Number(e.target.value) })}
                      sx={{ width: 140 }}
                    />
                  </Stack>

                  {it.type === "item" && (
                    <TextField
                      size="small"
                      label="Uses"
                      value={it.uses ?? ""}
                      onChange={(e) => updateItem(it.id, { uses: e.target.value })}
                    />
                  )}

                  {it.type === "cyberware" && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        size="small"
                        type="number"
                        label="Tier"
                        value={it.tier ?? 1}
                        onChange={(e) => updateItem(it.id, { tier: Number(e.target.value) })}
                        sx={{ width: 120 }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Installation Difficulty"
                        value={it.installationDifficulty ?? 0}
                        onChange={(e) => updateItem(it.id, { installationDifficulty: Number(e.target.value) })}
                        sx={{ width: 220 }}
                      />
                      <TextField
                        size="small"
                        label="Requirements"
                        value={it.requirements ?? ""}
                        onChange={(e) => updateItem(it.id, { requirements: e.target.value })}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                  )}

                  {it.type === "cyberware" && (
                    <TextField
                      size="small"
                      label="Physical Impact"
                      value={it.physicalImpact ?? ""}
                      onChange={(e) => updateItem(it.id, { physicalImpact: e.target.value })}
                    />
                  )}

                  {it.type === "narcotics" && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        size="small"
                        type="number"
                        label="Uses"
                        value={it.uses ?? 1}
                        onChange={(e) => updateItem(it.id, { uses: Number(e.target.value) })}
                        sx={{ width: 120 }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        label="Addiction Score"
                        value={it.addictionScore ?? 0}
                        onChange={(e) => updateItem(it.id, { addictionScore: Number(e.target.value) })}
                        sx={{ width: 160 }}
                      />
                      <TextField
                        size="small"
                        label="Legality"
                        value={it.legality ?? ""}
                        onChange={(e) => updateItem(it.id, { legality: e.target.value })}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                  )}

                  <TextField
                    size="small"
                    label="Effect"
                    value={it.effect ?? ""}
                    onChange={(e) => updateItem(it.id, { effect: e.target.value })}
                    multiline
                    minRows={2}
                  />

                  <TextField
                    size="small"
                    label="Status Effects (comma-separated)"
                    value={it.statusEffects ?? ""}
                    onChange={(e) => updateItem(it.id, { statusEffects: e.target.value })}
                    placeholder='e.g. "carrying_capacity+5"'
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Stack>
  );
}
