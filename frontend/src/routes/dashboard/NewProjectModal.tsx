import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
} from "solid-js";

import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cx } from "../../components/ui/cva";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import { TextField, TextFieldInput, TextFieldLabel } from "../../components/ui/text-field";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { api } from "../../lib/api";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

type Template = NonNullable<Awaited<ReturnType<typeof api.templates.get>>["data"]>[number];

const BLANK_ID = "blank";

async function loadTemplates(): Promise<Template[]> {
  const { data } = await api.templates.get();
  return data ?? [];
}

interface TemplateCardProps {
  selected: boolean;
  onSelect: () => void;
  thumbnailUrl: string | null;
  fallbackLabel: string;
  name: string;
  description: string;
}

function TemplateCard(props: TemplateCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      class={cx(
        "h-60 py-0 gap-0 overflow-hidden cursor-pointer transition-colors hover:border-foreground",
        props.selected && "border-foreground bg-muted"
      )}
      onClick={props.onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onSelect();
        }
      }}
    >
      <div class="h-40 shrink-0 bg-muted/40 border-b border-border overflow-hidden">
        <Show
          when={props.thumbnailUrl}
          fallback={
            <div class="size-full flex items-center justify-center text-muted-foreground/50 text-[11px] font-mono">
              {props.fallbackLabel}
            </div>
          }
        >
          <img
            src={props.thumbnailUrl ?? ""}
            alt=""
            loading="lazy"
            class="size-full object-cover object-top"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </Show>
      </div>
      <div class="flex-1 min-h-0 px-3 py-2.5 flex flex-col gap-0.5 overflow-hidden">
        <div class="font-sans text-sm font-medium text-foreground truncate">{props.name}</div>
        <div class="font-mono text-[10px] text-muted-foreground leading-snug line-clamp-2">
          {props.description}
        </div>
      </div>
    </Card>
  );
}

export default function NewProjectModal(props: NewProjectModalProps) {
  const [name, setName] = createSignal("");
  const [template, setTemplate] = createSignal(BLANK_ID);
  const [search, setSearch] = createSignal("");
  const [category, setCategory] = createSignal<string>("all");
  const [templates] = createResource(loadTemplates);

  createEffect(() => {
    if (props.open) {
      setName("");
      setTemplate(BLANK_ID);
      setSearch("");
      setCategory("all");
    }
  });

  const categories = createMemo(() => {
    const all = templates() ?? [];
    const set = new Set<string>();
    for (const t of all) for (const c of t.categories) set.add(c);
    return ["all", ...[...set].toSorted()];
  });

  const filtered = createMemo(() => {
    const all = templates() ?? [];
    const q = search().toLowerCase().trim();
    const cat = category();
    const matched = all.filter((t) => {
      const matchesCategory = cat === "all" || t.categories.includes(cat);
      const matchesQuery =
        !q || t.id.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
    return matched.toSorted((a, b) => a.id.localeCompare(b.id));
  });

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (!o) props.onClose();
      }}
    >
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name().trim();
            if (trimmed) props.onSubmit(trimmed);
          }}
          class="flex flex-col gap-4"
        >
          <TextField value={name()} onChange={setName}>
            <TextFieldLabel>Name</TextFieldLabel>
            <TextFieldInput autofocus type="text" placeholder="My document" />
          </TextField>
          <div class="flex flex-col gap-2.5">
            <span class="text-sm font-medium">Template</span>
            <ToggleGroup
              variant="outline"
              value={category()}
              onChange={(v) => setCategory(v ?? "all")}
              class="flex flex-wrap gap-1.5 w-full"
            >
              <For each={categories()}>
                {(c) => (
                  <ToggleGroupItem
                    value={c}
                    size="sm"
                    class="rounded-md! border-l! flex-none px-2.5"
                  >
                    {c}
                  </ToggleGroupItem>
                )}
              </For>
            </ToggleGroup>
            <Separator class="my-1" />
            <TextField value={search()} onChange={setSearch}>
              <TextFieldInput
                type="text"
                placeholder="Search templates…"
                class="font-mono text-xs"
              />
            </TextField>
            <div class="grid gap-2 h-96 overflow-y-auto p-0.5 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
              <TemplateCard
                selected={template() === BLANK_ID}
                onSelect={() => setTemplate(BLANK_ID)}
                thumbnailUrl={null}
                fallbackLabel="blank"
                name="Blank"
                description="Empty document"
              />
              <Switch
                fallback={
                  <For each={filtered()}>
                    {(t) => (
                      <TemplateCard
                        selected={template() === t.id}
                        onSelect={() => setTemplate(t.id)}
                        thumbnailUrl={t.thumbnailUrl}
                        fallbackLabel="no preview"
                        name={t.id}
                        description={t.description || "No description."}
                      />
                    )}
                  </For>
                }
              >
                <Match when={templates.loading}>
                  <For each={Array.from({ length: 8 })}>
                    {() => <Skeleton class="h-60 rounded-xl" />}
                  </For>
                </Match>
                <Match when={templates.error !== undefined}>
                  <Alert variant="destructive" class="col-span-full">
                    <AlertDescription>Could not load templates.</AlertDescription>
                  </Alert>
                </Match>
              </Switch>
            </div>
          </div>
          <DialogFooter>
            <a
              href="https://typst.app/universe"
              target="_blank"
              rel="noreferrer noopener"
              class="mr-auto self-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Browse Typst Universe ↗
            </a>
            <Button variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Tooltip openDelay={100} disabled={!!name().trim()}>
              <TooltipTrigger as="div" tabIndex={-1}>
                <Button
                  type="submit"
                  disabled={!name().trim()}
                  class={name().trim() ? undefined : "pointer-events-none"}
                >
                  Create
                </Button>
              </TooltipTrigger>
              <TooltipContent>A project name is required</TooltipContent>
            </Tooltip>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
