import { useColorMode } from "@kobalte/core/color-mode";
import {
  TbOutlineArrowAutofitHeight,
  TbOutlineArrowAutofitWidth,
  TbOutlineZoomIn,
  TbOutlineZoomOut,
} from "solid-icons/tb";
import { createSignal, For, Match, onCleanup, onMount, Switch } from "solid-js";

import { Button } from "../../components/ui/button";
import ExportPdfButton from "./ExportPdfButton";
import { useProjectContext } from "./ProjectContext";

const BASE_WIDTH_PX = 700;
const ZOOM_STEP = 1.1;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const SCROLLER_PADDING_PX = 24; // matches `p-3` (12px each side)

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export default function PreviewPane() {
  const ctx = useProjectContext();
  const { colorMode: theme } = useColorMode();
  const render = ctx.preview;
  const [zoom, setZoom] = createSignal(1);
  const [panning, setPanning] = createSignal(false);

  let scroller: HTMLDivElement | undefined;
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

  // Initial zoom: fit-width, capped at 100%. Defer one frame so layout settles.
  onMount(() => {
    requestAnimationFrame(() => {
      if (!scroller) return;
      const available = scroller.clientWidth - SCROLLER_PADDING_PX;
      if (available <= 0) return;
      const fit = available / BASE_WIDTH_PX;
      if (fit < 1) setZoom(clampZoom(fit));
    });
  });

  const onMouseMove = (e: MouseEvent) => {
    if (!panOrigin || !scroller) return;
    scroller.scrollLeft = panOrigin.scrollLeft - (e.clientX - panOrigin.x);
    scroller.scrollTop = panOrigin.scrollTop - (e.clientY - panOrigin.y);
  };

  const onMouseUp = () => {
    panOrigin = null;
    setPanning(false);
    globalThis.removeEventListener("mousemove", onMouseMove);
    globalThis.removeEventListener("mouseup", onMouseUp);
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0 || !scroller) return; // left button only
    e.preventDefault();
    scroller.focus({ preventScroll: true });
    panOrigin = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
    };
    setPanning(true);
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
        <div class="ml-auto">
          <ExportPdfButton />
        </div>
      </div>

      <div
        ref={(el) => {
          scroller = el;
        }}
        tabindex={-1}
        class="bg-muted/40 min-h-0 flex-1 cursor-grab overflow-auto p-3 outline-none"
        classList={{ "!cursor-grabbing select-none": panning() }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        <Switch fallback={<p class="text-muted-foreground text-sm">Compiling…</p>}>
          <Match when={render.pages}>
            {(p) => (
              <div
                class="mx-auto flex flex-col items-center gap-6"
                style={{
                  width: `${String(zoom() * BASE_WIDTH_PX)}px`,
                  ...(theme() === "dark" ? { filter: "invert(0.85) hue-rotate(180deg)" } : {}),
                }}
              >
                <For each={p()}>
                  {(page) => (
                    <div
                      class="w-full bg-white shadow-md ring-1 ring-black/10 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                      innerHTML={page.svg}
                    />
                  )}
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
