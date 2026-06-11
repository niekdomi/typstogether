import type { TypstProject } from "@vedivad/codemirror-typst";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createStore } from "solid-js/store";

/** Extra space above and below the viewport (px) treated as "visible", so a
 * page renders just before it scrolls into view. */
const DEFAULT_OVERSCAN_PX = 1200;

export interface UsePreviewRenderOptions {
  /** Live compiler instance; swaps on file change (`null` between projects). */
  project: () => TypstProject | null;
  /** Bumps on every successful compile; invalidates the per-page SVG cache. */
  version: () => number;
  /** Current number of renderable pages. */
  pageCount: () => number;
  /** Scroll container used as the IntersectionObserver root. */
  scroller: () => HTMLElement | undefined;
  overscan?: number;
}

export interface PreviewRender {
  /** Sparse index -> rendered SVG. An evicted page reads back `undefined`. */
  svgs: Record<number, string | undefined>;
  /** Wire a page wrapper element to the observer (call from its `ref`). */
  observe: (el: HTMLElement, index: number) => void;
  /** Detach a page wrapper element (call from the `ref`'s cleanup). */
  unobserve: (el: HTMLElement) => void;
}

/** CSS `aspect-ratio` value for a placeholder box, from a page's point dims. */
export function placeholderAspectRatio(page: { width: number; height: number }): string {
  return `${String(page.width)} / ${String(page.height)}`;
}

/** Read the `data-page-index` an element was tagged with, or -1 if absent. */
function pageIndexOf(el: HTMLElement): number {
  const raw = el.dataset["pageIndex"];
  const idx = raw === undefined ? Number.NaN : Number(raw);
  return Number.isNaN(idx) ? -1 : idx;
}

/**
 * Decide, for the current state, which pages need rendering and which cached
 * SVGs to drop. Pure so it can be unit-tested without a DOM or observer.
 *
 * - A page is rendered when it is visible, in range, not already in-flight, and
 *   its cached SVG (if any) is from an older version.
 * - A cached SVG is evicted as soon as its page leaves the visible (overscan)
 *   window, or its page is gone (past `pageCount`). This bounds how many page
 *   SVGs live in the DOM at once: without it, scrolling accumulates every page's
 *   SVG and reflows (e.g. dragging the panel handle) get progressively janky.
 *   Visible pages are always kept - including stale ones, whose old SVG stays on
 *   screen until the fresh render lands, avoiding a blank flash.
 */
export function reconcileCache(
  renderedVersion: ReadonlyMap<number, number>,
  currentVersion: number,
  visible: ReadonlySet<number>,
  pageCount: number,
  inFlight: ReadonlySet<number>
): { toRender: number[]; toEvict: number[] } {
  const toRender: number[] = [];
  for (const idx of visible) {
    if (idx < 0 || idx >= pageCount) continue;
    if (inFlight.has(idx)) continue;
    if (renderedVersion.get(idx) === currentVersion) continue;
    toRender.push(idx);
  }

  const toEvict: number[] = [];
  for (const idx of renderedVersion.keys()) {
    if (idx >= pageCount || !visible.has(idx)) toEvict.push(idx);
  }

  return { toRender, toEvict };
}

/**
 * Lazily render Typst preview pages: only pages near the viewport are
 * rasterized (via `project.renderPage`), and each rendered SVG is cached until
 * the next compile invalidates it. Pairs with PreviewPane's placeholder boxes,
 * which keep scroll height and navigation correct before a page renders.
 */
export function usePreviewRender(options: UsePreviewRenderOptions): PreviewRender {
  const overscan = options.overscan ?? DEFAULT_OVERSCAN_PX;

  const [svgs, setSvgs] = createStore<Record<number, string | undefined>>({});
  const [visible, setVisible] = createSignal<ReadonlySet<number>>(new Set());
  // Cached SVG's compile version, by index. Non-reactive: only read inside the
  // render effect, which is driven by `version`/`visible`/`tick`.
  const renderedVersion = new Map<number, number>();
  const inFlight = new Set<number>();
  // Bumped whenever a render settles, so the effect re-evaluates and picks up
  // work that was skipped while a now-superseded render was in flight.
  const [tick, setTick] = createSignal(0);

  let observer: IntersectionObserver | undefined;
  const observed = new Set<HTMLElement>();

  const observe = (el: HTMLElement, index: number) => {
    el.dataset["pageIndex"] = String(index);
    observed.add(el);
    observer?.observe(el);
  };

  const unobserve = (el: HTMLElement) => {
    observed.delete(el);
    observer?.unobserve(el);
    const idx = pageIndexOf(el);
    if (idx >= 0) {
      setVisible((prev) => {
        if (!prev.has(idx)) return prev;
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  // Refs fire during render (before this onMount), so any elements registered
  // so far are already in `observed`; wire them up once the root exists.
  onMount(() => {
    const root = options.scroller();
    observer = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const idx = pageIndexOf(entry.target as HTMLElement);
            if (idx < 0) continue;
            if (entry.isIntersecting) next.add(idx);
            else next.delete(idx);
          }
          return next;
        });
      },
      { root, rootMargin: `${String(overscan)}px 0px ${String(overscan)}px 0px`, threshold: 0 }
    );
    for (const el of observed) observer.observe(el);
    onCleanup(() => {
      observer?.disconnect();
      observer = undefined;
    });
  });

  // Render the missing visible pages and drop stale/out-of-range cache entries.
  createEffect(() => {
    const project = options.project();
    const currentVersion = options.version();
    const pageCount = options.pageCount();
    tick(); // re-run after each render settles

    const { toRender, toEvict } = reconcileCache(
      renderedVersion,
      currentVersion,
      visible(),
      pageCount,
      inFlight
    );

    for (const idx of toEvict) {
      renderedVersion.delete(idx);
      setSvgs(idx, undefined);
    }

    if (!project) return;
    for (const idx of toRender) {
      inFlight.add(idx);
      void (async () => {
        try {
          const svg = await project.renderPage(idx);
          // Drop a render that resolved after a project swap or newer compile.
          if (options.project() !== project || options.version() !== currentVersion) return;
          if (svg !== undefined) {
            setSvgs(idx, svg);
            renderedVersion.set(idx, currentVersion);
          }
        } catch {
          // A per-page render failure leaves the placeholder; a later compile
          // (or scroll back into view) retries.
        } finally {
          inFlight.delete(idx);
          setTick((t) => t + 1);
        }
      })();
    }
  });

  return { svgs, observe, unobserve };
}
