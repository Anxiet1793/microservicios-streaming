import type { TituloId } from "../../domain/value-objects/titulo-id";

export interface TitleIdGenerator {
  next(): TituloId;
}
