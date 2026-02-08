export function buildWhisperspaceSkillNotation(opts) {
    const net = Math.max(-2, Math.min(2, Math.trunc(opts.netDice)));
    const diceCount = 1 + Math.abs(net);
    let base = "1d12";
    if (net > 0)
        base = `${diceCount}d12kh1`;
    if (net < 0)
        base = `${diceCount}d12kl1`;
    const mod = Number.isFinite(opts.modifier) ? Math.trunc(opts.modifier) : 0;
    const modSuffix = mod === 0 ? "" : mod > 0 ? ` +${mod}` : ` ${mod}`;
    return `${base} # ${opts.label}${modSuffix}`;
}
