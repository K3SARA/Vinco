const store = new Map();

export function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttlMs = 30_000) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

export async function getOrSetCache(key, loader, ttlMs = 30_000) {
  const cached = getCache(key);
  if (cached !== null) return cached;
  return setCache(key, await loader(), ttlMs);
}

export function invalidateCache(prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const key of store.keys()) {
    if (list.some((prefix) => key.startsWith(prefix))) {
      store.delete(key);
    }
  }
}
