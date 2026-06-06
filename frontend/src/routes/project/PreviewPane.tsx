import { EditorView } from "@codemirror/view";
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

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// Client-space center of the link nearest the cursor on a page: among links whose
// column contains the x and whose center is within ~a line of the y, the closest,
// or null. Lets a click land on an outline entry (a thin hit-rect) without pixel
// precision, picking the nearest when stacked entries are close together.
function nearestLinkCenter(pageEl: HTMLElement, clientX: number, clientY: number) {
  let best: { x: number; y: number } | null = null;
  let bestDy = Infinity;
  for (const a of pageEl.querySelectorAll("a")) {
    const r = a.getBoundingClientRect();
    if (r.height === 0 || clientX < r.left || clientX > r.right) continue;
    const cy = r.top + r.height / 2;
    const dy = Math.abs(clientY - cy);
    if (dy <= r.height && dy < bestDy) {
      bestDy = dy;
      best = { x: (r.left + r.right) / 2, y: cy };
    }
  }
  return best;
}

export default function PreviewPane() {
  const ctx = useProjectContext();
  const render = ctx.preview;
  const [zoom, setZoom] = createSignal(1);
  const [panning, setPanning] = createSignal(false);

  let scroller: HTMLDivElement | undefined;
  // Page wrappers by index, so an internal link can scroll to its target page.
  const pageEls: (HTMLElement | undefined)[] = [];
  let panOrigin: { x: number; y: number; scrollLeft: number; scrollTop: number } | null = null;

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

  // Map a viewport point to the page under it and its position in that page's own
  // point coordinates (the SVG viewBox unit), which is what the engine expects.
  const pointToPage = (clientX: number, clientY: number) => {
    const pages = render.pages;
    if (!pages) return null;
    for (let i = 0; i < pageEls.length; i++) {
      const el = pageEls[i];
      const page = pages[i];
      if (!el || !page) continue;
      const r = el.getBoundingClientRect();
      if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
      const scale = (zoom() * BASE_WIDTH_PX) / page.width;
      return { index: i, x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
    }
    return null;
  };

  // Move the editor caret to a 1-based source location (same recipe as the
  // diagnostics panel: switch file, then dispatch once the view has swapped).
  const jumpToSource = (file: string, line: number, column: number) => {
    ctx.setActiveFile(file);
    queueMicrotask(() => {
      const view = ctx.editorView();
      if (!view) return;
      const doc = view.state.doc;
      const lineInfo = doc.line(Math.min(Math.max(line, 1), doc.lines));
      const from = Math.min(lineInfo.from + column - 1, lineInfo.to);
      view.dispatch({
        selection: { anchor: from },
        effects: EditorView.scrollIntoView(from, { y: "center" }),
      });
      view.focus();
    });
  };

  // Scroll the preview so a target point (in page points) sits near the top.
  const scrollToPosition = (page: number, yPt: number) => {
    const target = render.pages?.[page];
    const el = pageEls[page];
    if (!scroller || !target || !el) return;
    const scale = (zoom() * BASE_WIDTH_PX) / target.width;
    const pageTop = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTo({
      top: scroller.scrollTop + pageTop + yPt * scale - SCROLLER_PADDING_PX,
      behavior: "smooth",
    });
  };

  // A plain click: ask the engine what the cursor is over and act on it. Text
  // jumps the editor to its source; an internal link scrolls the preview; a URL
  // opens. The SVG carries none of this, so it's a round-trip to the engine.
  const handleClick = async (clientX: number, clientY: number) => {
    const project = ctx.typst.project;
    const here = pointToPage(clientX, clientY);
    if (!project || !here) return;
    // Snap to the nearest link so an outline entry needn't be clicked precisely;
    // off any link, resolve the raw point (text -> source).
    const el = pageEls[here.index];
    const center = el ? nearestLinkCenter(el, clientX, clientY) : null;
    const hit = center ? (pointToPage(center.x, center.y) ?? here) : here;
    const jump = await project.clickJump(hit.index, hit.x, hit.y);
    if (!jump) return;
    if (jump.kind === "source") jumpToSource(jump.file, jump.line, jump.column);
    else if (jump.kind === "position") scrollToPosition(jump.page, jump.y);
    else globalThis.open(jump.url, "_blank", "noopener,noreferrer");
  };

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
    if (wasClick) void handleClick(e.clientX, e.clientY);
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
          // We drive all navigation through the engine (handleClick), so stop the
          // browser from also following an SVG link's native href.
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
                    // handleClick snaps to the nearest link, so the thin band
                    // doesn't have to be hit precisely.
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
