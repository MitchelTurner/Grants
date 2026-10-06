import { openDB } from "idb";

export type PendingMatch = {
  clientId: string;
  awardId: string | null;
  volunteerName: string;
  date: string;
  hours: string | null;
  inKindValue: string | null;
  rate: string | null;
  description: string;
  photoDocumentIds: string[];
  lat: number | null;
  lng: number | null;
};

type StoredMatch = PendingMatch & { orgId: string };

const DB_NAME = "se-grants";
const STORE = "match-queue";

export function retainUnsent(pendingIds: string[], sentIds: string[]): string[] {
  const sent = new Set(sentIds);
  return pendingIds.filter((id) => !sent.has(id));
}

export function queuedMatch(input: Omit<PendingMatch, "clientId">, clientId: string): PendingMatch {
  return { ...input, clientId };
}

async function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientId" });
      }
    },
  });
}

export async function enqueueMatch(orgId: string, entry: PendingMatch): Promise<void> {
  const db = await database();
  const row: StoredMatch = { ...entry, orgId };
  await db.put(STORE, row);
}

export async function listQueued(orgId: string): Promise<PendingMatch[]> {
  const db = await database();
  const rows = (await db.getAll(STORE)) as StoredMatch[];
  return rows
    .filter((row) => row.orgId === orgId)
    .map((row) => ({
      clientId: row.clientId,
      awardId: row.awardId,
      volunteerName: row.volunteerName,
      date: row.date,
      hours: row.hours,
      inKindValue: row.inKindValue,
      rate: row.rate,
      description: row.description,
      photoDocumentIds: row.photoDocumentIds,
      lat: row.lat,
      lng: row.lng,
    }));
}

export async function flushMatchQueue(
  orgId: string,
  send: (entry: PendingMatch) => Promise<void>,
): Promise<{ sent: number; kept: number }> {
  const pending = await listQueued(orgId);
  const sentIds: string[] = [];
  for (const entry of pending) {
    try {
      await send(entry);
      sentIds.push(entry.clientId);
      const db = await database();
      await db.delete(STORE, entry.clientId);
    } catch {
      // Keep the row until the next connection.
    }
  }
  return {
    sent: sentIds.length,
    kept: retainUnsent(
      pending.map((row) => row.clientId),
      sentIds,
    ).length,
  };
}
