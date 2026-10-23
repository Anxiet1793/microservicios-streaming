import type { BulkCreateCatalogOutput } from "../../../application/dto/catalog-dto";

export function presentBulk(output: BulkCreateCatalogOutput): Response {
  const { summary, results } = output;
  let status: number;
  if (summary.indeterminate) status = 503;
  else if (summary.failed && (summary.inserted || summary.duplicates)) status = 207;
  else if (summary.failed) {
    const codes = results.flatMap((result) => ("code" in result ? [result.code] : []));
    status = codes.some((code) =>
      ["PERSISTENCE_WRITE_FAILED", "DOCUMENT_VALIDATION_FAILED"].includes(code),
    )
      ? 500
      : codes.every((code) => ["IMPORT_KEY_CONFLICT", "TITLE_ID_CONFLICT"].includes(code))
        ? 409
        : 400;
  } else status = summary.inserted ? 201 : 200;
  return Response.json(output, { status });
}
