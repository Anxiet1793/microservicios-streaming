export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues?: readonly ValidationIssue[],
  ) {
    super(message);
    this.name = "HttpError";
  }
}
