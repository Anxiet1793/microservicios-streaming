import { PUBLICATION_STATUSES, type PublicationStatusId } from "../models";
import { CatalogError } from "../errors/catalog-error";

export class EstadoPublicacion {
  private constructor(readonly id: PublicationStatusId) { Object.freeze(this); }

  static from(id: PublicationStatusId): EstadoPublicacion {
    if (typeof id !== "number" || !Object.hasOwn(PUBLICATION_STATUSES, id)) {
      throw new CatalogError("INVALID_CATALOG_STATE", "Estado de publicación desconocido.");
    }
    return new EstadoPublicacion(id);
  }

  transitionTo(id: PublicationStatusId): EstadoPublicacion {
    const target = EstadoPublicacion.from(id);
    if (this.id === id) return this;
    if ((this.id === 1 && id === 2) || (this.id === 2 && id === 3)) return target;
    throw new CatalogError("INVALID_PUBLICATION_TRANSITION", `No se puede cambiar de ${PUBLICATION_STATUSES[this.id]} a ${PUBLICATION_STATUSES[id]}.`);
  }
}
