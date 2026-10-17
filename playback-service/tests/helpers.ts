import { randomUUID } from "node:crypto";
import type { Dependencies, Repositories } from "../src/modules/playback/application/ports";
import type { ConsolidatedProgress, MediaAsset, PlaybackEvent, Session } from "../src/modules/playback/domain/model";
export const user = { userId: `usr_${randomUUID()}`, role: "USER" as const };
export const admin = { userId: `usr_${randomUUID()}`, role: "ADMIN" as const };
export const tituloId = `ttl_${randomUUID()}`;
export const asset: MediaAsset = { assetId: `ast_${randomUUID()}`, objectKey: "videos/test.mp4", bucket: "test", contentType: "video/mp4", originalFilename: "test.mp4", sizeBytes: 1024, durationSeconds: 120, codec: "h264", width: 320, height: 240, status: "READY", createdAt: new Date(), updatedAt: new Date(), referenceRevision: 0 };
export function fixture() {
  const assets = new Map([[asset.assetId, structuredClone(asset)]]), sessions = new Map<string, Session>(), progress = new Map<string, ConsolidatedProgress>(), events: PlaybackEvent[] = [];
  const r: Repositories = {
    assets: { find: async id => assets.get(id) ?? null, insert: async a => { assets.set(a.assetId, a); }, touchReady: async id => assets.get(id)?.status === "READY", markDeleted: async id => { assets.get(id)!.status = "DELETED"; } },
    sessions: { find: async id => sessions.get(id) ?? null, save: async s => { sessions.set(s.sessionId, s); }, hasOpenAsset: async id => [...sessions.values()].some(s => s.assetId === id && !s.supersededAt && ["ACTIVE", "PAUSED"].includes(s.status)) },
    progress: { find: async (u, t) => progress.get(u + t) ?? null, save: async p => { progress.set(p.userId + p.tituloId, p); }, list: async (u, page, limit, continuing) => { const data = [...progress.values()].filter(p => p.userId === u && (!continuing || p.continueWatching)); return { data, pagination: { page, limit, total: data.length, totalPages: 1 } }; } },
    outbox: { insert: async e => { events.push(e); } },
  };
  const d: Dependencies = { repositories: r, unit: { run: work => work(r) }, storage: { upload: async () => {}, delete: async () => {}, exists: async () => true, createPlaybackUrl: async () => ({ url: "http://storage.test/signed", expiresIn: 900 }) }, catalog: { get: async () => ({ published: true, assetId: asset.assetId }) }, events: { publish: (event, outbox) => outbox.insert(event) }, runtime: { now: () => new Date(), id: prefix => `${prefix}_${randomUUID()}` }, bucket: "test" };
  return { d, assets, sessions, progress, events };
}
