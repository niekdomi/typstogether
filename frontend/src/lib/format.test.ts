import { afterEach, describe, expect, setSystemTime, test } from "bun:test";

import { formatDate, formatRelative, userInitial } from "./format";

const NOW = new Date();

afterEach(() => {
  setSystemTime();
});

describe("formatRelative", () => {
  test("seconds ago", () => {
    setSystemTime(NOW);
    const t = new Date(NOW.getTime() - 30_000);
    expect(formatRelative(t)).toBe("30 seconds ago");
  });

  test("now / just now boundary", () => {
    setSystemTime(NOW);
    expect(formatRelative(NOW)).toBe("now");
  });

  test("minutes ago", () => {
    setSystemTime(NOW);
    const t = new Date(NOW.getTime() - 5 * 60_000);
    expect(formatRelative(t)).toBe("5 minutes ago");
  });

  test("hours ago", () => {
    setSystemTime(NOW);
    const t = new Date(NOW.getTime() - 3 * 3_600_000);
    expect(formatRelative(t)).toBe("3 hours ago");
  });

  test("yesterday boundary", () => {
    setSystemTime(NOW);
    const t = new Date(NOW.getTime() - 24 * 3_600_000);
    expect(formatRelative(t)).toBe("yesterday");
  });

  test("days ago", () => {
    setSystemTime(NOW);
    const t = new Date(NOW.getTime() - 5 * 86_400_000);
    expect(formatRelative(t)).toBe("5 days ago");
  });

  test("months ago", () => {
    setSystemTime(NOW);
    const t = new Date(NOW.getTime() - 60 * 86_400_000);
    expect(formatRelative(t)).toBe("2 months ago");
  });

  test("last year", () => {
    setSystemTime(NOW);
    const t = new Date(NOW.getTime() - 400 * 86_400_000);
    expect(formatRelative(t)).toBe("last year");
  });

  test("accepts ISO string", () => {
    setSystemTime(NOW);
    expect(formatRelative(new Date(NOW.getTime() - 60_000).toISOString())).toBe("1 minute ago");
  });
});

describe("formatDate", () => {
  test("formats a Date object", () => {
    expect(formatDate(new Date("2026-04-20T00:00:00Z"))).toBe("Apr 20, 2026");
  });

  test("accepts an ISO string", () => {
    expect(formatDate("2026-04-20T00:00:00Z")).toBe("Apr 20, 2026");
  });
});

describe("userInitial", () => {
  test("returns first letter uppercased", () => {
    expect(userInitial("alice")).toBe("A");
  });

  test("trims leading whitespace", () => {
    expect(userInitial("  bob")).toBe("B");
  });

  test("returns ? for empty string", () => {
    expect(userInitial("")).toBe("?");
  });

  test("returns ? for undefined", () => {
    const name = undefined;
    expect(userInitial(name)).toBe("?");
  });

  test("returns ? for whitespace-only string", () => {
    expect(userInitial("   ")).toBe("?");
  });
});
