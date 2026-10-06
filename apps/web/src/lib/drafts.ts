import { openDB } from "idb";

export type Draft = { title: string; body: string; savedAt: string };

const dbPromise = openDB("se-grants", 1, {
  upgrade(db) {
    db.createObjectStore("drafts");
  },
});

export async function saveDraft(key: string, draft: Draft): Promise<void> {
  const db = await dbPromise;
  await db.put("drafts", draft, key);
}

export async function readDraft(key: string): Promise<Draft | undefined> {
  const db = await dbPromise;
  return db.get("drafts", key);
}
