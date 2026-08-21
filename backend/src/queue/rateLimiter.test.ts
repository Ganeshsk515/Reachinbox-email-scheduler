import { describe, it, expect } from "vitest";
import { getStartOfNextHour } from "./rateLimiter";

describe("getStartOfNextHour", () => {
  it("returns a date at the top of the next hour", () => {
    const result = getStartOfNextHour();
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("returns a time strictly in the future", () => {
    const result = getStartOfNextHour();
    expect(result.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns exactly one hour ahead of the current hour boundary", () => {
    const now = new Date();
    const result = getStartOfNextHour();
    const expectedHour = (now.getUTCHours() + 1) % 24;
    expect(result.getUTCHours()).toBe(expectedHour);
  });
});