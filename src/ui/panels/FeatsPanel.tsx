import React from "react";
import { CharacterSheetV1, FeatSchema } from "../../rules/schema";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";

export function FeatsPanel(props: {
  sheet: CharacterSheetV1;
  onChange: (feats: CharacterSheetV1["feats"]) => void;
}) {
  const feats = props.sheet.feats ?? [];

  function addFeat() {
    props.onChange([...feats, { name: "New Feat", description: "", statusEffects: "" }]);
  }

  function updateFeat(i: number, patch: Partial<{ name: string; description: string; statusEffects: string }>) {
    const next = [...feats];
    next[i] = { ...next[i], ...patch };
    FeatSchema.safeParse(next[i]); // permissive
    props.onChange(next);
  }

  function removeFeat(i: number) {
    const next = [...feats];
    next.splice(i, 1);
    props.onChange(next);
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Feats</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={addFeat}>
          Add Feat
        </Button>
      </Stack>

      {feats.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          No feats yet.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {feats.map((f, i) => (
            <Paper key={`${f.name}-${i}`} sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Feat Name"
                    fullWidth
                    value={f.name}
                    onChange={(e) => updateFeat(i, { name: e.target.value })}
                  />
                  <IconButton aria-label="Remove feat" onClick={() => removeFeat(i)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>

                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  minRows={4}
                  value={f.description}
                  onChange={(e) => updateFeat(i, { description: e.target.value })}
                />

                <TextField
                  label="Status Effects"
                  fullWidth
                  helperText='Comma-separated, e.g. "carrying_capacity+5"'
                  value={(f as any).statusEffects ?? ""}
                  onChange={(e) => updateFeat(i, { statusEffects: e.target.value })}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
