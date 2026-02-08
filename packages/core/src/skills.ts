export type FocusId = string;

export type LearnedSkill = {
  id: string;
};

export function buildLearnedInfoById<T extends string>(learned: Record<T, LearnedSkill[]>) {
  const map = new Map<string, { focus: T }>();
  (Object.keys(learned ?? {}) as T[]).forEach((focus) => {
    (learned[focus] ?? []).forEach((s) => map.set(s.id, { focus }));
  });
  return map;
}

export function skillModifierFor<T extends string>(opts: {
  learnedInfoById: Map<string, { focus: T }>;
  skillId: string;
  ranks?: Record<string, number>;
  learningFocus?: T;
  skillMods?: Record<string, number>;
}): number {
  const skillId = String(opts.skillId ?? "");
  const rank = (opts.ranks?.[skillId] ?? 0) as number;
  const bonus = opts.skillMods?.[skillId] ?? 0;
  if (rank > 0) return rank + bonus;

  const learningFocus = opts.learningFocus ?? ("combat" as T);
  const learnedInfo = opts.learnedInfoById.get(skillId);
  const base = learnedInfo && learnedInfo.focus === learningFocus ? 0 : -1;
  return base + bonus;
}
