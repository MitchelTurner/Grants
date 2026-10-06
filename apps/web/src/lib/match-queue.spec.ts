import { describe, expect, it } from "vitest";
import { queuedMatch, retainUnsent } from "./match-queue";

describe("match queue", () => {
  it("keeps a client id so a replay does not create a second log", () => {
    const entry = queuedMatch(
      {
        awardId: null,
        volunteerName: "Ada",
        date: "2026-10-01",
        hours: "2.00",
        inKindValue: null,
        rate: null,
        description: "Food delivery",
        photoDocumentIds: [],
        lat: null,
        lng: null,
      },
      "clientid01",
    );
    expect(entry.clientId).toBe("clientid01");
    expect(retainUnsent([entry.clientId, "still-here"], [entry.clientId])).toEqual(["still-here"]);
  });
});