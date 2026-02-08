import React, { useEffect, useMemo, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import type { Item } from "@owlbear-rodeo/sdk";
import type { Player } from "@owlbear-rodeo/sdk";

import { PLAYER_KEY_MY_TOKEN, TOKEN_KEY_OWNER_PLAYER, setMyCharacterTokenId } from "../../obr/metadata";

import { Box, Button, Divider, Stack, Typography } from "@mui/material";

type PlayerRow = {
  id: string;
  name: string;
  role: "GM" | "PLAYER";
  metadata: Record<string, any>;
};

export function OwnershipPanel(props: { isGM: boolean }) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    let unsubPlayers: (() => void) | null = null;
    let unsubItems: (() => void) | null = null;

    OBR.onReady(async () => {
      if (!mounted) return;
      try {
        const myId = await OBR.player.getId();
        if (mounted) setMyPlayerId(myId);
      } catch {
        // ignore
      }

      const loadPlayers = async () => {
        try {
          const list = await OBR.party.getPlayers();
          if (!mounted) return;
          setPlayers(
            (list ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              metadata: (p as any).metadata ?? {},
            }))
          );
        } catch {
          if (mounted) setPlayers([]);
        }
      };

      const loadItems = async () => {
        try {
          const list = await OBR.scene.items.getItems();
          if (!mounted) return;
          setItems(list ?? []);
        } catch {
          if (mounted) setItems([]);
        }
      };

      await Promise.all([loadPlayers(), loadItems()]);

      unsubPlayers = OBR.party.onChange((list) => {
        setPlayers(
          (list ?? []).map((p: Player) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            metadata: (p as any).metadata ?? {},
          }))
        );
      });

      unsubItems = (OBR as any)?.scene?.items?.onChange?.(() => {
        void loadItems();
      });
    });

    return () => {
      mounted = false;
      if (typeof unsubPlayers === "function") unsubPlayers();
      if (typeof unsubItems === "function") unsubItems();
    };
  }, []);

  const tokenInfoById = useMemo(() => {
    const map = new Map<string, { name: string }>();
    for (const it of items) {
      const name =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (it as any)?.text?.plainText?.trim?.() || (it as any)?.name || "Token";
      map.set(it.id, { name });
    }
    return map;
  }, [items]);

  const ownedTokensByPlayer = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const it of items) {
      const ownerId = (it as any)?.metadata?.[TOKEN_KEY_OWNER_PLAYER];
      if (!ownerId) continue;
      const entry = map.get(ownerId) ?? [];
      entry.push(it.id);
      map.set(ownerId, entry);
    }
    return map;
  }, [items]);

  async function assignSelectedTokenToPlayer(playerId: string) {
    const selection = (await OBR.player.getSelection()) ?? [];
    const tokenId = selection?.[0];
    if (!tokenId) {
      void OBR.notification.show("Select a token to assign.", "WARNING");
      return;
    }
    await OBR.scene.items.updateItems([tokenId], (drafts) => {
      const it = drafts[0];
      if (!it) return;
      it.metadata[TOKEN_KEY_OWNER_PLAYER] = playerId;
    });

    if (playerId === myPlayerId) {
      await setMyCharacterTokenId(tokenId);
    }
  }

  async function clearTokenOwnership(playerId: string) {
    const owned = items.filter((it) => (it as any)?.metadata?.[TOKEN_KEY_OWNER_PLAYER] === playerId);
    if (owned.length === 0) return;
    const ids = owned.map((it) => it.id);
    await OBR.scene.items.updateItems(ids, (drafts) => {
      drafts.forEach((it) => {
        if (!it) return;
        delete it.metadata[TOKEN_KEY_OWNER_PLAYER];
      });
    });
  }

  async function clearTokenOwnerById(tokenId: string) {
    await OBR.scene.items.updateItems([tokenId], (drafts) => {
      const it = drafts[0];
      if (!it) return;
      delete it.metadata[TOKEN_KEY_OWNER_PLAYER];
    });
  }

  async function clearPlayerMetadata(playerId: string) {
    if (playerId !== myPlayerId) return;
    await setMyCharacterTokenId(null);
  }

  if (!props.isGM) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="h6" sx={{ m: 0 }}>Ownership</Typography>
        <Typography sx={{ opacity: 0.8, mt: 1 }}>GM only.</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ m: 0 }}>Ownership</Typography>
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          Assign tokens to players via selection. Ownership uses token metadata; player metadata is shown for reference.
        </Typography>
      </Box>

      <Divider />

      {players.length === 0 ? (
        <Typography sx={{ opacity: 0.75 }}>No players found.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {players.map((p) => {
            const ownedTokenIds = ownedTokensByPlayer.get(p.id) ?? [];
            const ownedTokens = ownedTokenIds.map((id) => ({
              id,
              name: tokenInfoById.get(id)?.name ?? id,
            }));

            const playerMetaTokenId = p.metadata?.[PLAYER_KEY_MY_TOKEN] as string | undefined;
            const playerMetaTokenName = playerMetaTokenId ? tokenInfoById.get(playerMetaTokenId)?.name : undefined;

            return (
              <Box key={p.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                  <Box>
                    <Typography fontWeight={700}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {p.role} • {p.id}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button size="small" variant="outlined" onClick={() => void assignSelectedTokenToPlayer(p.id)}>
                      Assign Selected Token
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => void clearTokenOwnership(p.id)}>
                      Clear Token Ownership
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Token Metadata Ownership:
                  </Typography>
                  {ownedTokens.length ? (
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {ownedTokens.map((t) => (
                        <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography variant="body2">{t.name}</Typography>
                          <Button size="small" variant="outlined" onClick={() => void clearTokenOwnerById(t.id)}>
                            Unassign
                          </Button>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ mt: 0.25 }}>—</Typography>
                  )}
                </Box>

                <Box sx={{ mt: 0.75 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Player Metadata (myCharacterTokenId):
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 0.25 }}>
                    <Typography variant="body2">
                      {playerMetaTokenId ? `${playerMetaTokenName ?? "Unknown token"} (${playerMetaTokenId})` : "—"}
                    </Typography>
                    {playerMetaTokenId && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => void clearPlayerMetadata(p.id)}
                        disabled={p.id !== myPlayerId}
                      >
                        Clear
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
