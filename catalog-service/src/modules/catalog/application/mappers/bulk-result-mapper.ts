import type { BulkCreateCatalogOutput, BulkItemResult } from "../dto/catalog-dto";

export function toBulkOutput(received: number, items: readonly BulkItemResult[]): BulkCreateCatalogOutput {
  const results = [...items].sort((a, b) => a.index - b.index);
  const summary = {
    received,
    inserted: results.filter(result => result.status === "inserted").length,
    duplicates: results.filter(result => result.status === "duplicate").length,
    failed: results.filter(result => result.status === "rejected").length,
    indeterminate: results.filter(result => result.status === "indeterminate").length,
  };
  return {
    success: summary.failed === 0 && summary.indeterminate === 0,
    summary, results,
    errors: results.flatMap(result => "code" in result ? [{ index: result.index, code: result.code }] : []),
  };
}
