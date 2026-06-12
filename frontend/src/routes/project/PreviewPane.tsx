import { PreviewNavigator } from "@vedivad/typst-web-service";
import {
  TbOutlineArrowAutofitHeight,
  TbOutlineArrowAutofitWidth,
  TbOutlineMoon,
  TbOutlineSun,
  TbOutlineZoomIn,
  TbOutlineZoomOut,
} from "solid-icons/tb";
import { createSignal, Index, onCleanup, onMount, Show } from "solid-js";

import { Spinner } from "../../components/Spinner";
import { Button } from "../../components/ui/button";
import { previewDark, setPreviewDark } from "../../lib/editor-prefs";
import { placeholderAspectRatio, usePreviewRender } from "../../lib/typst/use-preview-render";
import ExportPdfButton from "./ExportPdfButton";
import ExportProjectButton from "./ExportProjectButton";
import { attachPan } from "./preview-pan";
import { useProjectContext } from "./ProjectContext";

const BASE_WIDTH_PX = 700;
const ZOOM_STEP = 1.1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const SCROLLER_PADDING_PX = 24; // matches `p-3` (12px each side)
const OUTLINE_SCROLL_MARGIN_PX = 80; // space above heading when navigating via outline/link

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export default function PreviewPane() {
  const ctx = useProjectContext();
  const render = ctx.preview;
  const [zoom, setZoom] = createSignal(1);

  let scroller: HTMLDivElement | undefined;
  // Page wrappers by index; the navigator reads these to resolve clicks and scroll.
  const pageEls: (HTMLElement | undefined)[] = [];
  let nav: PreviewNavigator | undefined;

  // Lazily render only the pages near the viewport; `svgs[i]` fills in as each
  // page scrolls into range, and clears when a new compile invalidates it.
  const { svgs, observe, unobserve } = usePreviewRender({
    project: () => ctx.typst.project,
    version: () => render.version,
    pageCount: () => render.pages?.length ?? 0,
    scroller: () => scroller,
  });

  /**
   * Zoom around an anchor point (mouse cursor when ctrl+wheel; container
   * center when button-driven). Adjusts scroll so the anchor stays under the
   * cursor after the resize.
   */
  const zoomAt = (newZoom: number, anchorClientX?: number, anchorClientY?: number) => {
    if (!scroller) return;
    const next = clampZoom(newZoom);
    const prev = zoom();
    if (next === prev) return;
    const ratio = next / prev;

    const rect = scroller.getBoundingClientRect();
    const ax = (anchorClientX ?? rect.left + rect.width / 2) - rect.left;
    const ay = (anchorClientY ?? rect.top + rect.height / 2) - rect.top;
    const sl = scroller.scrollLeft;
    const st = scroller.scrollTop;

    setZoom(next);
    requestAnimationFrame(() => {
      if (!scroller) return;
      scroller.scrollLeft = (sl + ax) * ratio - ax;
      scroller.scrollTop = (st + ay) * ratio - ay;
    });
  };

  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const next = e.deltaY > 0 ? zoom() / ZOOM_STEP : zoom() * ZOOM_STEP;
    zoomAt(next, e.clientX, e.clientY);
  };

  const fitHeight = () => {
    if (!scroller) return;
    const firstPage = render.pages?.[0];
    if (!firstPage) return;
    const available = scroller.clientHeight - SCROLLER_PADDING_PX;
    if (available <= 0) return;
    const pageHeightPx = (firstPage.height / firstPage.width) * BASE_WIDTH_PX;
    zoomAt(available / pageHeightPx);
  };

  const fitWidth = () => {
    if (!scroller) return;
    const available = scroller.clientWidth - SCROLLER_PADDING_PX;
    if (available <= 0) return;
    zoomAt(available / BASE_WIDTH_PX);
  };

  // Initial zoom: fit-width, capped at 100%. The preview lives in a resizable
  // panel whose final width is applied after mount, at an inconsistent time
  // across browsers (Chromium often isn't laid out by the next frame). So fit
  // on the first real width via ResizeObserver, then stop so we don't fight the
  // user's later zoom/resizes.
  onMount(() => {
    requestAnimationFrame(() => {
      if (!scroller) return;
      const available = scroller.clientWidth - SCROLLER_PADDING_PX;
      if (available <= 0) return;
      const fit = available / BASE_WIDTH_PX;
      if (fit < 1) setZoom(clampZoom(fit));
    });
  });

  // Forward navigation through the engine: a click resolves to a source location,
  // an internal-link scroll, or a URL. The project is read via a thunk since the
  // context swaps the instance on file change.
  onMount(() => {
    if (!scroller) return;
    nav = PreviewNavigator.create({
      project: () => ctx.typst.project!,
      scroller,
      pages: () => pageEls,
      listen: false,
      onSource: ctx.gotoSource,
      margin: OUTLINE_SCROLL_MARGIN_PX,
    });
  });

  onCleanup(() => nav?.dispose());

  return (
    <div class="flex h-full w-full flex-col">
      <div class="border-border/60 flex shrink-0 items-center gap-1 border-b px-2 py-1">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => {
            zoomAt(zoom() / ZOOM_STEP);
          }}
        >
          <TbOutlineZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="w-14 font-mono tabular-nums"
          title="Reset zoom"
          aria-label="Reset zoom"
          onClick={() => {
            zoomAt(1);
          }}
        >
          {Math.round(zoom() * 100)}%
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => {
            zoomAt(zoom() * ZOOM_STEP);
          }}
        >
          <TbOutlineZoomIn />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Fit width"
          aria-label="Fit width"
          onClick={fitHeight}
        >
          <TbOutlineArrowAutofitHeight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Fit width"
          aria-label="Fit width"
          onClick={fitWidth}
        >
          <TbOutlineArrowAutofitWidth />
        </Button>
        <div class="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title={previewDark() ? "Light preview" : "Dark preview"}
            aria-label={previewDark() ? "Switch to light preview" : "Switch to dark preview"}
            aria-pressed={previewDark()}
            onClick={() => {
              setPreviewDark((d) => !d);
            }}
          >
            <Show when={previewDark()} fallback={<TbOutlineMoon />}>
              <TbOutlineSun />
            </Show>
          </Button>
          <ExportProjectButton />
          <ExportPdfButton />
        </div>
      </div>

      <div
        ref={(el) => {
          scroller = el;
          attachPan(el);
        }}
        tabindex={-1}
        class="bg-muted/40 min-h-0 flex-1 scrollbar-gutter-stable overflow-auto p-3 outline-none select-none"
        onWheel={onWheel}
        onClick={(e) => {
          e.preventDefault(); // stop SVG native href
          void nav?.jumpAt(e.clientX, e.clientY);
        }}
      >
        {/* Until assets/fonts finish loading, compiles report them as missing
            files; suppress those transient errors and show a loading state. */}
        <Show when={ctx.previewReady() && render.error}>
          {(reason) => (
            <div class="bg-destructive/10 text-destructive ring-destructive/20 sticky top-0 z-10 mb-3 rounded-md px-3 py-2 ring-1">
              <pre class="font-mono text-xs whitespace-pre-wrap">{reason()}</pre>
            </div>
          )}
        </Show>
        <Show
          when={render.pages}
          fallback={
            <div class="flex h-full items-center justify-center">
              <Show
                when={ctx.previewReady()}
                fallback={
                  <div class="text-muted-foreground flex items-center gap-2 text-sm">
                    <Spinner />
                    Loading project…
                  </div>
                }
              >
                <Show when={!render.error}>
                  <p class="text-muted-foreground text-sm">Compiling…</p>
                </Show>
              </Show>
            </div>
          }
        >
          {(p) => (
            <div
              class="mx-auto flex flex-col items-center gap-6"
              style={{
                width: `${String(zoom() * BASE_WIDTH_PX)}px`,
                ...(previewDark() ? { filter: "invert(0.85) hue-rotate(180deg)" } : {}),
              }}
            >
              <Index each={p()}>
                {(page, i) => {
                  // Placeholder box sized from the page's point dimensions so
                  // scroll height, zoom, and navigation stay correct before the
                  // SVG arrives. Typst draws each link as a transparent <rect>
                  // over the glyphs: tint it on hover and show a pointer.
                  return (
                    <div
                      data-page-index={i}
                      ref={(el) => {
                        pageEls[i] = el;
                        observe(el, i);
                        onCleanup(() => {
                          unobserve(el);
                          if (pageEls[i] === el) pageEls[i] = undefined;
                        });
                      }}
                      class="w-full bg-white shadow-md ring-1 ring-black/10 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg_a]:cursor-pointer [&_svg_a_rect]:[transition:fill_100ms] [&_svg_a:hover_rect]:fill-yellow-300/50"
                      style={{ "aspect-ratio": placeholderAspectRatio(page()) }}
                      innerHTML={svgs[i] ?? ""}
                    />
                  );
                }}
              </Index>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
