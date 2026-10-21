import { describe, expect, it } from "vitest";
import { trackingSchema } from "./checkout";

describe("trackingSchema", () => {
  it("accepts a TikTok pixel id and uppercases it", () => {
    expect(trackingSchema.parse({ tiktokPixelId: "c1a2b3c4d5", customScript: null }).tiktokPixelId).toBe("C1A2B3C4D5");
  });
  it("rejects a pixel id with script characters", () => {
    expect(trackingSchema.safeParse({ tiktokPixelId: "abc');x('", customScript: null }).success).toBe(false);
  });
  it("rejects custom scripts over 20000 chars", () => {
    expect(trackingSchema.safeParse({ tiktokPixelId: null, customScript: "a".repeat(20001) }).success).toBe(false);
  });
});
