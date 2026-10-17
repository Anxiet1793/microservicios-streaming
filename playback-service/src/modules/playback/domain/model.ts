export type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "TITLE_NOT_FOUND" | "MEDIA_ASSET_NOT_FOUND" | "PLAYBACK_SESSION_NOT_FOUND" | "INVALID_PLAYBACK_TRANSITION" | "TITLE_NOT_PUBLISHED" | "FILE_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "CATALOG_SERVICE_UNAVAILABLE" | "STORAGE_UNAVAILABLE" | "MEDIA_ASSET_IN_USE" | "SESSION_SUPERSEDED" | "RATE_LIMITED";
export class PlaybackError extends Error { constructor(readonly code: ErrorCode) { super(code); } }
export function fail(code: ErrorCode): never { throw new PlaybackError(code); }
export const identifier = (prefix: string) => new RegExp(`^${prefix}_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`);
export type Status = "REQUESTED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED";
export interface Progress { positionSeconds: number; durationSeconds: number; percentage: number; updatedAt: Date }
export function progress(positionSeconds: number, durationSeconds: number, now: Date): Progress {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || positionSeconds > durationSeconds + 2) fail("VALIDATION_ERROR");
  const position = Math.min(positionSeconds, durationSeconds);
  return { positionSeconds: position, durationSeconds, percentage: Math.round(position / durationSeconds * 10000) / 100, updatedAt: now };
}
export interface Session {
  sessionId: string; userId: string; tituloId: string; assetId: string; status: Status; progress: Progress;
  startedAt: Date; lastActivityAt: Date; completedAt: Date | null; supersededAt: Date | null; emittedMilestone: number;
}
export class PlaybackSession {
  constructor(readonly state: Session) {}
  assertOwner(userId: string) { if (this.state.userId !== userId) fail("FORBIDDEN"); }
  assertCurrent() { if (this.state.supersededAt) fail("SESSION_SUPERSEDED"); }
  supersede(now: Date): Session {
    if (!["ACTIVE", "PAUSED"].includes(this.state.status)) fail("INVALID_PLAYBACK_TRANSITION");
    return { ...this.state, supersededAt: now };
  }
  transition(status: Status, now: Date): Session {
    this.assertCurrent();
    const allowed: Record<Status, Status[]> = { REQUESTED: ["ACTIVE"], ACTIVE: ["PAUSED", "COMPLETED", "FAILED"], PAUSED: ["ACTIVE", "COMPLETED"], COMPLETED: [], FAILED: [] };
    if (!allowed[this.state.status].includes(status)) fail("INVALID_PLAYBACK_TRANSITION");
    return { ...this.state, status, lastActivityAt: now, completedAt: status === "COMPLETED" ? now : null };
  }
  update(position: number, now: Date): Session {
    this.assertCurrent();
    if (!["ACTIVE", "PAUSED"].includes(this.state.status)) fail("INVALID_PLAYBACK_TRANSITION");
    return { ...this.state, progress: progress(position, this.state.progress.durationSeconds, now), lastActivityAt: now };
  }
}
export interface MediaAsset { assetId: string; objectKey: string; bucket: string; contentType: "video/mp4"; originalFilename: string; sizeBytes: number; durationSeconds: number; codec: string; width: number; height: number; status: "READY" | "DELETED"; createdAt: Date; updatedAt: Date; referenceRevision: number }
export interface ConsolidatedProgress { userId: string; tituloId: string; assetId: string; progress: Progress; status: "IN_PROGRESS" | "COMPLETED"; continueWatching: boolean; lastSessionId: string; lastActivityAt: Date }
export interface PlaybackEvent { eventId: string; eventType: "PLAYBACK_STARTED" | "PLAYBACK_PAUSED" | "PLAYBACK_COMPLETED" | "PLAYBACK_PROGRESS_UPDATED"; version: 1; occurredAt: Date; userId: string; tituloId: string; data: { sessionId: string; completionPercentage: number; watchTimeSeconds: null }; deliveryStatus: "PENDING" }
