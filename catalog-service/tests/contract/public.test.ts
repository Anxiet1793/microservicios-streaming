import { expect, it } from "vitest";
import SwaggerParser from "@apidevtools/swagger-parser";
import { z } from "zod";
import { toCatalogTitleDto } from "../../src/modules/catalog/application/mappers/catalog-dto-mapper";
import { movie, movieInput } from "../helpers/fixtures";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { PUBLICATION_STATUSES } from "../../src/modules/catalog/domain/models";

it("preserves the public playback-facing reference and publication contract for all statuses", async () => {
  await SwaggerParser.validate("docs/openapi.yaml");
  const title = movie(),
    now = new Date(),
    published = title.changePublicationStatus(2, now),
    withdrawn = published.changePublicationStatus(3, now);
  const consumer = z.object({
    tituloId: z.string().regex(/^ttl_/),
    publicationStatusId: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    playbackReference: z
      .object({ assetId: z.string(), providerId: z.number(), manifestKey: z.string() })
      .nullable(),
  });
  for (const item of [title, published, withdrawn]) {
    const dto = toCatalogTitleDto(item);
    expect(consumer.parse(dto).tituloId).toBe(title.tituloId);
    expect(dto.publicationStatusName).toBe(PUBLICATION_STATUSES[dto.publicationStatusId]);
    for (const field of ["_id", "importFingerprint", "importKey", "schemaVersion", "version"])
      expect(dto).not.toHaveProperty(field);
  }
});
it("keeps the declared status IDs synchronized with the producer's domain", async () => {
  const spec = parse(await readFile("docs/openapi.yaml", "utf8"));
  expect(spec.components.schemas.PublicationStatusId.enum).toEqual(
    Object.keys(PUBLICATION_STATUSES).map(Number),
  );
});
it("serializes optional editorial data without losing numeric/name equivalences", () => {
  const title = movie({
    ficha: {
      ...movieInput().ficha,
      originalTitle: "Original",
      director: "Director",
      cast: ["Actor"],
      ageRatingId: 4,
      backdropUrl: "https://example.test/backdrop.jpg",
    },
  });
  const dto = toCatalogTitleDto(title);
  expect(dto.ficha).toMatchObject({
    originalTitle: "Original",
    director: "Director",
    cast: ["Actor"],
    ageRatingId: 4,
    backdropUrl: "https://example.test/backdrop.jpg",
  });
  expect(dto.ficha.ageRatingName).toBeTruthy();
  expect(dto.ficha.genresName).toHaveLength(dto.ficha.genres.length);
  expect(dto.ficha.languagesName).toHaveLength(dto.ficha.languages.length);
});
