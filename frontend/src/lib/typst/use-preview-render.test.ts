import { describe, expect, test } from "bun:test";

import { placeholderAspectRatio, reconcileCache } from "./use-preview-render";

const rendered = (entries: [number, number][]) => new Map<number, number>(entries);
const set = (...idx: number[]) => new Set(idx);

describe("reconcileCache", () => {
  test("renders a newly-visible page that has no cached SVG", () => {
    const { toRender, toEvict } = reconcileCache(rendered([]), 1, set(0, 1), 3, set());
    expect(toRender).toEqual([0, 1]);
    expect(toEvict).toEqual([]);
  });

  test("skips a visible page already rendered at the current version", () => {
    const { toRender, toEvict } = reconcileCache(rendered([[0, 1]]), 1, set(0, 1), 3, set());
    expect(toRender).toEqual([1]);
    expect(toEvict).toEqual([]);
  });

  test("skips in-flight pages so they are not rendered twice", () => {
    const { toRender } = reconcileCache(rendered([]), 1, set(0, 1, 2), 3, set(1));
    expect(toRender).toEqual([0, 2]);
  });

  test("ignores visible indices outside the page range", () => {
    const { toRender } = reconcileCache(rendered([]), 1, set(0, 5), 3, set());
    expect(toRender).toEqual([0]);
  });

  test("on a version bump, re-renders the still-visible page", () => {
    const { toRender, toEvict } = reconcileCache(rendered([[0, 1]]), 2, set(0), 3, set());
    expect(toRender).toEqual([0]);
    expect(toEvict).toEqual([]); // kept on screen until the fresh render resolves
  });

  test("on a version bump, evicts a stale off-screen page", () => {
    const { toRender, toEvict } = reconcileCache(rendered([[2, 1]]), 2, set(), 3, set());
    expect(toRender).toEqual([]);
    expect(toEvict).toEqual([2]);
  });

  test("evicts a current-version page once it scrolls out of the visible window", () => {
    // No edit (version unchanged), but page 2 is no longer visible: drop its SVG
    // so the DOM stays bounded while scrolling.
    const { toRender, toEvict } = reconcileCache(rendered([[2, 1]]), 1, set(0), 3, set());
    expect(toRender).toEqual([0]);
    expect(toEvict).toEqual([2]);
  });

  test("keeps a current-version page that is still visible", () => {
    const { toRender, toEvict } = reconcileCache(rendered([[1, 1]]), 1, set(0, 1, 2), 3, set());
    expect(toRender).toEqual([0, 2]); // 1 already current; 0 and 2 need rendering
    expect(toEvict).toEqual([]);
  });

  test("evicts pages that fell out of range when the doc shrank", () => {
    const { toRender, toEvict } = reconcileCache(
      rendered([
        [0, 1],
        [3, 1],
        [4, 1],
      ]),
      1,
      set(0),
      2,
      set()
    );
    expect(toRender).toEqual([]);
    expect(toEvict).toEqual([3, 4]);
  });
});

describe("placeholderAspectRatio", () => {
  test("formats width / height in points", () => {
    expect(placeholderAspectRatio({ width: 595.28, height: 841.89 })).toBe("595.28 / 841.89");
  });
});
