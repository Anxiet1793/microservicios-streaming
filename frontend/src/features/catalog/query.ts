export function exploreQuery(
  query: Record<string, string | string[] | undefined>,
) {
  const result = new URLSearchParams({ limit: "24" });
  const bounds: Record<string, [number, number]> = {
    type: [1, 2],
    genre: [1, 15],
    year: [1888, 9999],
    page: [1, 417],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = query[key];
    if (
      typeof value === "string" &&
      /^\d+$/.test(value) &&
      Number(value) >= min &&
      Number(value) <= max
    )
      result.set(key, String(Number(value)));
  }
  if (typeof query.q === "string") {
    const q = [...query.q.trim()].slice(0, 100).join("");
    if (/[\p{L}\p{N}]/u.test(q)) result.set("q", q);
  }
  return result;
}
