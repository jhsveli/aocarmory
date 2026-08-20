import { describe, expect, it } from "vitest";
import { decodeBuilder, encodeBuilder } from "../lib/builder";

// A real ab= value captured from the archived site (Shattered Souls set).
const REAL_AB =
  "eNoVilEKgDAMxa6krgr2nWbapxWGwqp4fedXEkj49RRj1TSjcA%2BVDp5Pa9JjdcatMmBhaUxwZlMRbGTrEW89%2FmH6AESrFvc%3D";

describe("builder codec", () => {
  it("decodes a real ab= param from the archived site", async () => {
    const pairs = await decodeBuilder(REAL_AB);
    expect(pairs).toEqual([
      { slot: "shoulder", itemId: 39 },
      { slot: "legs", itemId: 40 },
      { slot: "hands", itemId: 41 },
      { slot: "chest", itemId: 42 },
      { slot: "belt", itemId: 43 },
      { slot: "head", itemId: 44 },
      { slot: "feet", itemId: 45 },
      { slot: "wrist", itemId: 46 },
    ]);
  });

  it("round-trips encode -> decode", async () => {
    const pairs: Array<[string, number]> = [
      ["head", 44],
      ["chest", 42],
      ["ring", 1234],
    ];
    const ab = await encodeBuilder(pairs);
    const decoded = await decodeBuilder(ab);
    expect(decoded).toEqual([
      { slot: "head", itemId: 44 },
      { slot: "chest", itemId: 42 },
      { slot: "ring", itemId: 1234 },
    ]);
  });

  it("decodes a url-encoded param with %2F / %2B inside (valid archive link)", async () => {
    // Dark Malice (PvE Tier 3) link captured from the section page
    const ab =
      "eNodylEKgCAQRdEtVVqgbzWWzyYYCrRo%2Bzn9HS63yfVoZo3BBazUOwY%2F4a1HM42QdObW5SBMucNDuVtZUEibBmzCf58%2F8xsYvw%3D%3D";
    const pairs = await decodeBuilder(ab);
    expect(pairs).toEqual([
      { slot: "shoulder", itemId: 939 },
      { slot: "belt", itemId: 942 },
      { slot: "wrist", itemId: 941 },
      { slot: "hands", itemId: 943 },
      { slot: "head", itemId: 944 },
      { slot: "legs", itemId: 946 },
      { slot: "feet", itemId: 940 },
      { slot: "chest", itemId: 945 },
    ]);
  });

  it("handles corrupt params gracefully (returns [])", async () => {
    const pairs = await decodeBuilder("eNpNotReallyBase64!%3D%3D");
    expect(pairs).toEqual([]);
  });
});
