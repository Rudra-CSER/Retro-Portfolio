// Visitor counter, kept in storage/visits.json as { "count": 123 }.

export function sanitizeVisits(value) {
  const count = Number(value?.count);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('expected { "count": <whole number> }');
  return { count };
}

export function createVisitsService(store) {
  return {
    count: () => store.get().count,

    async increment() {
      const next = await store.update(({ count }) => ({ count: count + 1 }));
      return next.count;
    },
  };
}
