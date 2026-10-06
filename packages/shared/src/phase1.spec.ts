import { describe, expect, it } from "vitest";
import { nextDueDate, nextForm990DueDate } from "./compliance-templates";
import { displayDeadline, subtractBusinessDays } from "./dates";
import { scoreFit } from "./fit";
import { formatMoney } from "./money";
import { rankNextActions } from "./next-actions";
import { shiftSmsToQuietEnd, smsBody } from "./reminders";

describe("fit scoring", () => {
  const base = {
    orgType: "NONPROFIT_501C3",
    community: "Juneau",
    servesCommunities: ["Sitka"],
    focusAreas: ["Arts & Culture", "Education & Youth"],
    eligibleOrgTypes: ["NONPROFIT_501C3"],
    eligibleCommunities: ["Juneau"],
    focusAreasOnOpportunity: ["Arts & Culture", "Education & Youth", "Housing"],
  };

  it("marks a restricted miss as not eligible", () => {
    const result = scoreFit({ ...base, orgType: "SMALL_BUSINESS" });
    expect(result.label).toBe("not_eligible");
    expect(result.reasons[0]).toMatch(/organization type/i);
  });

  it("scores an explicit match as a good fit", () => {
    const result = scoreFit(base);
    expect(result.score).toBe(40 + 25 + 20);
    expect(result.label).toBe("good_fit");
  });

  it("scores unrestricted type and place as a possible fit when focus does not overlap", () => {
    const result = scoreFit({
      ...base,
      eligibleOrgTypes: [],
      eligibleCommunities: [],
      focusAreas: [],
    });
    expect(result.score).toBe(20 + 15);
    expect(result.label).toBe("possible_fit");
  });
});

describe("deadline display", () => {
  const instant = new Date("2026-03-13T03:59:00.000Z");

  it("shows Alaska time and the original Eastern time", () => {
    const display = displayDeadline(instant, "America/Juneau", "America/New_York");
    expect(display.timezonesDiffer).toBe(true);
    expect(display.primary).toContain("Alaska");
    expect(display.primary).toContain("7:59 PM");
    expect(display.original).toContain("Eastern");
    expect(display.original).toContain("11:59 PM");
  });

  it("subtracts business days and skips the weekend", () => {
    const friday = new Date("2026-03-13T16:00:00.000Z");
    const earlier = subtractBusinessDays(friday, 1, "America/Juneau");
    expect(earlier.toISOString().slice(0, 10)).toBe("2026-03-12");
    const afterWeekend = subtractBusinessDays(
      new Date("2026-03-16T16:00:00.000Z"),
      1,
      "America/Juneau",
    );
    expect(afterWeekend.toISOString().slice(0, 10)).toBe("2026-03-13");
  });
});

describe("next actions", () => {
  it("sorts by date and then by type priority", () => {
    const ranked = rankNextActions(
      [
        { type: "opportunity", title: "Watch", dueAt: "2026-04-01", href: "/o" },
        { type: "compliance", title: "SAM", dueAt: "2026-04-01", href: "/c" },
        { type: "document", title: "Insurance", dueAt: "2026-03-20", href: "/d" },
      ],
      2,
    );
    expect(ranked.map((item) => item.title)).toEqual(["Insurance", "SAM"]);
  });
});

describe("reminders", () => {
  it("moves a late-night text to 8am local", () => {
    const night = new Date("2026-01-16T07:30:00.000Z");
    const shifted = shiftSmsToQuietEnd(night, "America/Juneau", 21, 8);
    expect(shifted.toISOString()).toBe("2026-01-16T17:00:00.000Z");
  });

  it("keeps the text inside one SMS segment", () => {
    const body = smsBody({
      title: "Rasmuson community grant application",
      days: 2,
      itemsLeft: 3,
      link: "https://example.org/go/abc",
    });
    expect(body.length).toBeLessThanOrEqual(160);
    expect(body.startsWith("SE Grants:")).toBe(true);
  });
});

describe("compliance dates", () => {
  it("computes Form 990 as the 15th of the 5th month after fiscal year end", () => {
    expect(nextForm990DueDate(1, "2026-01-01")).toBe("2026-05-15");
    expect(nextForm990DueDate(7, "2026-01-01")).toBe("2026-11-15");
  });

  it("rolls a yearly rule forward", () => {
    expect(nextDueDate("FREQ=YEARLY;INTERVAL=1", "2026-05-15")).toBe("2027-05-15");
  });
});

describe("money", () => {
  it("formats decimal strings without binary float artifacts", () => {
    expect(formatMoney("1000000.10")).toBe("$1,000,000.10");
  });
});
