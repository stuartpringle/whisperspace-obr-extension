import React from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import PsychologyAltIcon from "@mui/icons-material/PsychologyAlt";
import type { CombatLogPayload } from "./weaponAttack";

export function CombatLog(props: {
  entries: CombatLogPayload[];
  onApply?: (entry: CombatLogPayload) => void;
}) {
  const damageColor = "#e55353";
  const stressColor = "#8b5cf6";
  const infoColor = "#5b6bff";
  const hitColor = "#26a269";
  const missColor = "#d64040";

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
      <Typography variant="subtitle2" sx={{ opacity: 0.8, mb: 0.5 }}>Combat Log</Typography>
      {props.entries.length === 0 ? (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>No recent rolls.</Typography>
      ) : (
        <Stack spacing={0.75}>
          {props.entries.map((entry) => {
            const canApply =
              !!entry.outcome?.hit &&
              ((entry.outcome?.totalDamage ?? 0) > 0 || (entry.outcome?.stressDelta ?? 0) > 0) &&
              !!props.onApply;
            const canApplyDamage = canApply && (entry.outcome?.totalDamage ?? 0) > 0;
            const canApplyStress = canApply && (entry.outcome?.stressDelta ?? 0) > 0;
            const canApplyBoth = canApplyDamage && canApplyStress;

            const outcome = entry.outcome;
            const statusLabel = outcome?.isCrit ? "Extreme success - crit!" : outcome?.hit ? "Hit" : "Miss";
            const statusColor = outcome?.isCrit ? infoColor : outcome?.hit ? hitColor : missColor;
            const attacker = entry.attackerName ?? "Unknown";
            const weapon = entry.weaponName ?? "Attack";

            return (
              <Box key={entry.ts} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="body2" sx={{ flex: "1 1 260px" }}>
                  {entry.kind === "effect" ? (
                    <>
                      <strong>{entry.targetName ?? "Target"}</strong>{" "}
                      {((entry.damageApplied ?? 0) > 0) && (
                        <>
                          took{" "}
                          <strong style={{ color: damageColor }}>{entry.damageApplied}</strong>{" "}
                          damage
                        </>
                      )}
                      {((entry.damageApplied ?? 0) > 0) && ((entry.stressApplied ?? 0) > 0) && " and "}
                      {((entry.damageApplied ?? 0) <= 0) && ((entry.stressApplied ?? 0) > 0) && "took "}
                      {((entry.stressApplied ?? 0) > 0) && (
                        <>
                          <strong style={{ color: stressColor }}>{entry.stressApplied}</strong>{" "}
                          stress
                        </>
                      )}
                      .
                    </>
                  ) : (
                    <>
                      <strong>{attacker}</strong>: <strong>{weapon}</strong> rolled{" "}
                      {outcome?.total ?? 0} vs DC {outcome?.useDC ?? 0}.{" "}
                      <strong style={{ color: statusColor }}>{statusLabel}</strong>
                      {outcome?.hit && (
                        <>
                          . Damage:{" "}
                          <strong style={{ color: damageColor }}>{outcome?.totalDamage ?? 0}</strong>
                          {outcome?.stressDelta ? (
                            <>
                              {" "} (+{" "}
                              <strong style={{ color: stressColor }}>{outcome.stressDelta}</strong>{" "}
                              Stress)
                            </>
                          ) : null}
                        </>
                      )}
                      .
                    </>
                  )}
                </Typography>
                {canApplyDamage && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LocalFireDepartmentIcon fontSize="small" />}
                    onClick={() => props.onApply?.({ ...entry, kind: "attack", damageApplied: entry.outcome?.totalDamage ?? 0, stressApplied: 0 })}
                  >
                    Apply Damage
                  </Button>
                )}
                {canApplyStress && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PsychologyAltIcon fontSize="small" />}
                    onClick={() => props.onApply?.({ ...entry, kind: "attack", damageApplied: 0, stressApplied: entry.outcome?.stressDelta ?? 0 })}
                  >
                    Apply Stress
                  </Button>
                )}
                {canApplyBoth && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LocalFireDepartmentIcon fontSize="small" />}
                    onClick={() => props.onApply?.({ ...entry, kind: "attack", damageApplied: entry.outcome?.totalDamage ?? 0, stressApplied: entry.outcome?.stressDelta ?? 0 })}
                  >
                    Apply Both
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
