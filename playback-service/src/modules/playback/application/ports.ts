import type { ConsolidatedProgress, MediaAsset, PlaybackEvent, Session } from "../domain/model";
export interface Identity { userId: string; role: "USER" | "ADMIN" }
export interface MediaAssetRepository { find(id: string): Promise<MediaAsset | null>; insert(asset: MediaAsset): Promise<void>; touchReady(id: string): Promise<boolean>; markDeleted(id: string, now: Date): Promise<void> }
export interface PlaybackSessionRepository { find(id: string): Promise<Session | null>; save(session: Session): Promise<void>; hasOpenAsset(id: string): Promise<boolean> }
export interface Page<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface PlaybackProgressRepository { find(userId: string, tituloId: string): Promise<ConsolidatedProgress | null>; save(value: ConsolidatedProgress): Promise<void>; list(userId: string, page: number, limit: number, continuing: boolean): Promise<Page<ConsolidatedProgress>> }
export interface OutboxRepository { insert(event: PlaybackEvent): Promise<void> }
export interface Repositories { assets: MediaAssetRepository; sessions: PlaybackSessionRepository; progress: PlaybackProgressRepository; outbox: OutboxRepository }
export interface UnitOfWork { run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> }
export interface EventPublisher { publish(event: PlaybackEvent, outbox: OutboxRepository): Promise<void> }
export interface CatalogGateway { get(tituloId: string): Promise<{ published: boolean; assetId: string | null }> }
export interface MediaStorage { upload(objectKey: string, path: string, sizeBytes: number): Promise<void>; delete(objectKey: string): Promise<void>; exists(objectKey: string): Promise<boolean>; createPlaybackUrl(objectKey: string): Promise<{ url: string; expiresIn: number }> }
export interface Runtime { now(): Date; id(prefix: string): string }
export interface Upload { path: string; filename: string; sizeBytes: number; durationSeconds: number; codec: string; width: number; height: number }
export interface Dependencies { repositories: Repositories; unit: UnitOfWork; storage: MediaStorage; catalog: CatalogGateway; events: EventPublisher; runtime: Runtime; bucket: string }
