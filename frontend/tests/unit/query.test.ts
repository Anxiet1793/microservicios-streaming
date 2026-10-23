import { describe, it, expect } from "vitest";
import { exploreQuery } from "../../src/features/catalog/query";
describe("URL search boundary", () => {
  it("normalizes hostile or out-of-contract filters before calling Catalog", () => {
    const q = exploreQuery({
      type: "3",
      genre: "$ne",
      year: "-1",
      page: "999999",
      q: "!!!",
    });
    expect([...q.keys()]).toEqual(["limit"]);
  });
  it("keeps Spanish search and normalizes valid numeric values", () => {
    const q = exploreQuery({
      q: "  exposición  ",
      type: "01",
      genre: "10",
      year: "2026",
      page: "2",
    });
    expect(q.get("q")).toBe("exposición");
    expect(q.get("type")).toBe("1");
    expect(q.get("page")).toBe("2");
  });
  it("limits query length without breaking Unicode characters", () => {
    expect([...exploreQuery({ q: "ñ".repeat(120) }).get("q")!]).toHaveLength(100);
  });
});
