import { describe, expect, it } from "vitest";
import { fieldAccuracy } from "./accuracy";
import { needsMarkers, registrationWarnings } from "./needs";
import { RfpExtraction } from "./rfp-extraction";
import { SAMPLE_RFP_EXTRACTION, sampleDraft } from "./sample";

describe("phase 2 shared helpers", () => {
  it("accepts the sample extraction", () => {
    expect(RfpExtraction.parse(SAMPLE_RFP_EXTRACTION).programTitle).toBe("Harbor Safety Sample");
  });

  it("lists needs markers and SAM warnings", () => {
    expect(needsMarkers("Ask [NEEDS: ferry cost] and [NEEDS: year built].")).toEqual([
      "ferry cost",
      "year built",
    ]);
    expect(registrationWarnings(["SAM.gov registration"], null)).toHaveLength(1);
    expect(registrationWarnings(["SAM.gov registration"], "ABC123")).toEqual([]);
  });

  it("scores field accuracy and drafts a gap marker", () => {
    const report = fieldAccuracy({ title: "Harbor" }, { title: "harbor" });
    expect(report.matched).toBe(1);
    const miss = fieldAccuracy({ title: "Harbor" }, { title: "Trail" });
    expect(miss.misses).toEqual(["$.title"]);
    expect(
      sampleDraft({ orgName: "Harbor", community: "Haines", mission: "", facts: [] }),
    ).toContain("[NEEDS: your mission in one sentence]");
  });
});
