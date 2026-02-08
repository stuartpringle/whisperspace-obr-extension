export type HookPayloads = {
  "dice:roll": {
    diceNotation: string;
    rollTarget?: string;
    showResults?: boolean;
    rollId?: string;
  };
  "attack:resolved": {
    total: number;
    useDC: number;
    hit: boolean;
    isCrit: boolean;
    baseDamage: number;
    totalDamage: number;
    stressDelta: number;
    label?: string;
  };
  "damage:applied": {
    incomingDamage: number;
    unmitigated?: boolean;
    stressDelta?: number;
    resultingStress?: number;
  };
};

export type HookName = keyof HookPayloads;
type HookHandler<T extends HookName> = (payload: HookPayloads[T]) => void;

export type HookBus = {
  on<T extends HookName>(name: T, handler: HookHandler<T>): () => void;
  emit<T extends HookName>(name: T, payload: HookPayloads[T]): void;
};

const HOOKS_KEY = "__whisperspace_hooks";

export function getHookBus(): HookBus {
  const g = globalThis as any;
  if (g[HOOKS_KEY]) return g[HOOKS_KEY] as HookBus;

  const handlers = new Map<HookName, Set<Function>>();

  const bus: HookBus = {
    on(name, handler) {
      const set = handlers.get(name) ?? new Set();
      set.add(handler);
      handlers.set(name, set);
      return () => {
        set.delete(handler);
      };
    },
    emit(name, payload) {
      const set = handlers.get(name);
      if (!set) return;
      for (const fn of Array.from(set)) {
        try {
          (fn as any)(payload);
        } catch (err) {
          console.warn(`[hooks] handler failed for ${name}`, err);
        }
      }
    },
  };

  g[HOOKS_KEY] = bus;
  return bus;
}
