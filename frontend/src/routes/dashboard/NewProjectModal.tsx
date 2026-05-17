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
  onSubmit: (name: string, template: { id: string; version: string } | undefined) => void;
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
      <div class="bg-muted/40 border-border h-40 shrink-0 overflow-hidden border-b">
        <Show
          when={props.thumbnailUrl}
          fallback={
            <div class="text-muted-foreground/50 flex size-full items-center justify-center font-mono text-[11px]">
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
      <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-3 py-2.5">
        <div class="text-foreground truncate font-sans text-sm font-medium">{props.name}</div>
        <div class="text-muted-foreground line-clamp-2 font-mono text-[10px] leading-snug">
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
  const [category, setCategory] = createSignal("all");
  const [templates] = createResource(loadTemplates);
  const trimmedName = createMemo(() => name().trim());

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
            if (!trimmedName()) return;
            const id = template();
            const chosen =
              id === BLANK_ID ? undefined : (templates() ?? []).find((t) => t.id === id);
            const payload = chosen ? { id: chosen.id, version: chosen.version } : undefined;
            props.onSubmit(trimmedName(), payload);
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
              class="flex w-full flex-wrap gap-1.5"
            >
              <For each={categories()}>
                {(c) => (
                  <ToggleGroupItem
                    value={c}
                    size="sm"
                    class="flex-none rounded-md! border-l! px-2.5"
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
            <div class="grid h-96 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2 overflow-y-auto p-0.5">
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
              class="text-muted-foreground hover:text-foreground mr-auto self-center text-xs transition-colors"
            >
              Browse Typst Universe ↗
            </a>
            <Button variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Tooltip openDelay={100} disabled={!!trimmedName()}>
              <TooltipTrigger as="div" tabIndex={-1}>
                <Button
                  type="submit"
                  disabled={!trimmedName()}
                  class={trimmedName() ? undefined : "pointer-events-none"}
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
