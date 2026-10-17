import { randomUUID } from "node:crypto";
import type { TitleIdGenerator } from "../../application/ports/title-id-generator";
import { TituloId } from "../../domain/value-objects/titulo-id";

export class UuidTitleIdGenerator implements TitleIdGenerator {
  next(): TituloId { return TituloId.from(`ttl_${randomUUID()}`); }
}
