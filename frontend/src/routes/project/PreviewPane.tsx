import { PreviewNavigator } from "@vedivad/typst-web-service";
import {
  TbOutlineArrowAutofitHeight,
  TbOutlineArrowAutofitWidth,
  TbOutlineMoon,
  TbOutlineSun,
  TbOutlineZoomIn,
  TbOutlineZoomOut,
} from "solid-icons/tb";
import { createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";

import { Button } from "../../components/ui/button";
import { previewDark, setPreviewDark } from "../../lib/editor-prefs";
import ExportPdfButton from "./ExportPdfButton";
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
  const [panning, setPanning] = createSignal(false);

  let scroller: HTMLDivElement | undefined;
  // Page wrappers by index; the navigator reads these to resolve clicks and scroll.
  const pageEls: (HTMLElement | undefined)[] = [];
  let panOrigin: { x: number; y: number; scrollLeft: number; scrollTop: number } | null = null;
  let nav: PreviewNavigator | undefined;

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
  // an internal-link scroll, or a URL. We own pointer handling (pan vs click), so
  // listen:false and we call jumpAt from onMouseUp. The project is read via a thunk
  // since the context swaps the instance on file change.
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

  // A press that moves past this many pixels is a pan, not a click; below it we
  // treat the release as a click and ask the engine what's under the cursor.
  const DRAG_THRESHOLD_PX = 4;
  let dragMoved = false;

  const onMouseMove = (e: MouseEvent) => {
    if (!panOrigin || !scroller) return;
    const dx = e.clientX - panOrigin.x;
    const dy = e.clientY - panOrigin.y;
    // Only enter the panning state (grabbing cursor) once it's really a drag, so a
    // plain click doesn't flash the hand.
    if (!dragMoved && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
      dragMoved = true;
      setPanning(true);
    }
    scroller.scrollLeft = panOrigin.scrollLeft - dx;
    scroller.scrollTop = panOrigin.scrollTop - dy;
  };

  const onMouseUp = (e: MouseEvent) => {
    const wasClick = !dragMoved;
    panOrigin = null;
    setPanning(false);
    globalThis.removeEventListener("mousemove", onMouseMove);
    globalThis.removeEventListener("mouseup", onMouseUp);
    if (wasClick && ctx.typst.project) void nav?.jumpAt(e.clientX, e.clientY);
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || !scroller) return; // left button only
    e.preventDefault();
    dragMoved = false;
    scroller.focus({ preventScroll: true });
    panOrigin = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
    };
    globalThis.addEventListener("mousemove", onMouseMove);
    globalThis.addEventListener("mouseup", onMouseUp);
  };

  onCleanup(() => {
    globalThis.removeEventListener("mousemove", onMouseMove);
    globalThis.removeEventListener("mouseup", onMouseUp);
    nav?.dispose();
  });

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
          <ExportPdfButton />
        </div>
      </div>

      <div
        ref={(el) => {
          scroller = el;
        }}
        tabindex={-1}
        class="bg-muted/40 min-h-0 flex-1 scrollbar-gutter-stable overflow-auto p-3 outline-none"
        classList={{ "!cursor-grabbing select-none": panning() }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onClick={(e) => {
          // We drive all navigation through the engine (the navigator), so stop
          // the browser from also following an SVG link's native href.
          e.preventDefault();
        }}
      >
        <Switch fallback={<p class="text-muted-foreground text-sm">Compiling…</p>}>
          <Match when={render.pages}>
            {(p) => (
              <div
                class="mx-auto flex flex-col items-center gap-6"
                style={{
                  width: `${String(zoom() * BASE_WIDTH_PX)}px`,
                  ...(previewDark() ? { filter: "invert(0.85) hue-rotate(180deg)" } : {}),
                }}
              >
                <For each={p()}>
                  {(page) => {
                    // Typst draws each link as a transparent <rect> on top of the
                    // glyphs: tint it on hover to mark the link (kept at its true
                    // size so stacked entries never overlap) and show a pointer.
                    return (
                      <div
                        ref={(el) => {
                          pageEls[page.index] = el;
                        }}
                        class="w-full bg-white shadow-md ring-1 ring-black/10 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full [&_svg_a]:cursor-pointer [&_svg_a_rect]:[transition:fill_100ms] [&_svg_a:hover_rect]:fill-yellow-300/50"
                        innerHTML={page.svg}
                      />
                    );
                  }}
                </For>
              </div>
            )}
          </Match>
          <Match when={render.error}>
            {(reason) => (
              <pre class="text-destructive font-mono text-sm whitespace-pre-wrap">{reason()}</pre>
            )}
          </Match>
        </Switch>
      </div>
    </div>
  );
}
