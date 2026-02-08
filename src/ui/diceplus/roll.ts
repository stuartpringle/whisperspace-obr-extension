import OBR from "@owlbear-rodeo/sdk";
import { buildWhisperspaceSkillNotation } from "@whisperspace/sdk";
export { buildWhisperspaceSkillNotation };
import { getHookBus } from "@whisperspace/sdk";

export const DICEPLUS_CHANNEL_READY = "dice-plus/isReady";
export const DICEPLUS_CHANNEL_ROLL_REQUEST = "dice-plus/roll-request";

/**
 * IMPORTANT:
 * Dice+ returns results on `${source}/roll-result`
 * This MUST be a stable string used consistently for send + listen.
 */
export const DICEPLUS_SOURCE = "whisperspace.obr.sheet";

export type RollTarget = "everyone" | "self" | "dm" | "gm_only";

export async function checkDicePlusReady(timeoutMs = 1000): Promise<boolean> {
  const requestId = crypto.randomUUID();

  return new Promise<boolean>((resolve) => {
    const unsubscribe = OBR.broadcast.onMessage(
      DICEPLUS_CHANNEL_READY,
      (event) => {
        const data = event.data as any;
        if (data?.requestId === requestId && data.ready === true) {
          unsubscribe();
          resolve(true);
        }
      }
    );

    void OBR.broadcast.sendMessage(
      DICEPLUS_CHANNEL_READY,
      { requestId, timestamp: Date.now() },
      { destination: "ALL" }
    );

    setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
  });
}

/**
 * Fire-and-forget roll (skills, attacks, etc.)
 */
export async function rollWithDicePlus(opts: {
  diceNotation: string;
  rollTarget?: RollTarget;
  showResults?: boolean;
}) {
  const rollId = crypto.randomUUID();
  getHookBus().emit("dice:roll", {
    diceNotation: opts.diceNotation,
    rollTarget: opts.rollTarget,
    showResults: opts.showResults,
    rollId,
  });

  await OBR.broadcast.sendMessage(
    DICEPLUS_CHANNEL_ROLL_REQUEST,
    {
      rollId,
      playerId: await OBR.player.getId(),
      playerName: await OBR.player.getName(),
      rollTarget: opts.rollTarget ?? "everyone",
      diceNotation: opts.diceNotation,
      showResults: opts.showResults ?? true,
      timestamp: Date.now(),
      source: DICEPLUS_SOURCE,
    },
    { destination: "ALL" }
  );

  return rollId;
}

/**
 * Roll and wait for a numeric total (initiative)
 */
export async function rollWithDicePlusTotal(opts: {
  diceNotation: string;
  rollTarget?: RollTarget;
  showResults?: boolean;
  timeoutMs?: number;
}): Promise<number> {
  const ready = await checkDicePlusReady();
  if (!ready) {
    throw new Error("Dice+ is not available");
  }

  const rollId = crypto.randomUUID();
  const timeoutMs = opts.timeoutMs ?? 5000;
  getHookBus().emit("dice:roll", {
    diceNotation: opts.diceNotation,
    rollTarget: opts.rollTarget,
    showResults: opts.showResults,
    rollId,
  });

  return new Promise<number>(async (resolve, reject) => {
    const extractTotal = (data: any): number => {
      const candidates = [
        data?.total,
        data?.value,
        data?.result?.total,
        data?.result?.totalValue,
      ];
      for (const c of candidates) {
        const n = typeof c === "number" ? c : typeof c === "string" ? Number(c) : NaN;
        if (Number.isFinite(n)) return Math.trunc(n);
      }
      return NaN;
    };

    const unsubscribeResult = OBR.broadcast.onMessage(
      `${DICEPLUS_SOURCE}/roll-result`,
      (event) => {
        const data = event.data as any;
        if (data?.rollId === rollId) {
          const total = extractTotal(data);
          if (!Number.isFinite(total)) {
            // Keep waiting; some Dice+ configs may omit totals in the first payload.
            return;
          }
          cleanup();
          resolve(total);
        }
      }
    );

    const unsubscribeError = OBR.broadcast.onMessage(
      `${DICEPLUS_SOURCE}/roll-error`,
      (event) => {
        const data = event.data as any;
        if (data?.rollId === rollId) {
          cleanup();
          reject(new Error(data?.error || "Dice+ roll failed"));
        }
      }
    );

    const cleanup = () => {
      unsubscribeResult();
      unsubscribeError();
    };

    await OBR.broadcast.sendMessage(
      DICEPLUS_CHANNEL_ROLL_REQUEST,
      {
        rollId,
        playerId: await OBR.player.getId(),
        playerName: await OBR.player.getName(),
        rollTarget: opts.rollTarget ?? "everyone",
        diceNotation: opts.diceNotation,
        showResults: opts.showResults ?? true,
        timestamp: Date.now(),
        source: DICEPLUS_SOURCE,
      },
      { destination: "ALL" }
    );

    setTimeout(() => {
      cleanup();
      reject(new Error("Dice+ roll timed out (no roll-result received)"));
    }, timeoutMs);
  });
}
