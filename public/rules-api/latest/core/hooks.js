const HOOKS_KEY = "__whisperspace_hooks";
export function getHookBus() {
    const g = globalThis;
    if (g[HOOKS_KEY])
        return g[HOOKS_KEY];
    const handlers = new Map();
    const bus = {
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
            if (!set)
                return;
            for (const fn of Array.from(set)) {
                try {
                    fn(payload);
                }
                catch (err) {
                    console.warn(`[hooks] handler failed for ${name}`, err);
                }
            }
        },
    };
    g[HOOKS_KEY] = bus;
    return bus;
}
