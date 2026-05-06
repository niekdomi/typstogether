import { For, Match, Switch, createMemo, createResource, createSignal } from "solid-js";

import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
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
import { api } from "../../lib/api";
import { cx } from "../../lib/cva";

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

export default function NewProjectModal(props: NewProjectModalProps) {
  const [name, setName] = createSignal("");
  const [template, setTemplate] = createSignal(BLANK_ID);
  const [search, setSearch] = createSignal("");
  const [category, setCategory] = createSignal<string>("all");
  const [templates] = createResource(loadTemplates);

  const categories = createMemo(() => {
    const all = templates() ?? [];
    const set = new Set<string>();
    for (const t of all) for (const c of t.categories) set.add(c);
    return [...set].toSorted();
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
              <ToggleGroupItem value="all" size="sm" class="rounded-md! border-l! flex-none px-2.5">
                all
              </ToggleGroupItem>
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
            <div class="grid gap-2 max-h-80 overflow-y-auto p-0.5 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
              <Card
                role="button"
                tabIndex={0}
                class={cx(
                  "px-3.5 py-3 gap-1 cursor-pointer transition-colors hover:border-foreground",
                  template() === BLANK_ID && "border-foreground bg-muted"
                )}
                onClick={() => setTemplate(BLANK_ID)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setTemplate(BLANK_ID);
                  }
                }}
              >
                <div class="font-sans text-sm font-medium text-foreground">Blank</div>
                <div class="font-mono text-[11px] text-foreground/75 leading-[1.4]">
                  Empty document.
                </div>
              </Card>
              <Switch
                fallback={
                  <For each={filtered()}>
                    {(t) => (
                      <Card
                        role="button"
                        tabIndex={0}
                        class={cx(
                          "px-3.5 py-3 gap-1 cursor-pointer transition-colors hover:border-foreground",
                          template() === t.id && "border-foreground bg-muted"
                        )}
                        onClick={() => setTemplate(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setTemplate(t.id);
                          }
                        }}
                      >
                        <div class="font-sans text-sm font-medium text-foreground">{t.id}</div>
                        <div class="font-mono text-[11px] text-foreground/75 leading-[1.4]">
                          {t.description || "No description."}
                        </div>
                        <div class="font-mono text-[10px] text-muted-foreground mt-auto">
                          v{t.version}
                          {t.categories.length > 0 ? ` · ${t.categories.join(", ")}` : ""}
                        </div>
                      </Card>
                    )}
                  </For>
                }
              >
                <Match when={templates.loading}>
                  <For each={Array.from({ length: 6 })}>{() => <Skeleton class="h-[76px]" />}</For>
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
            <Button variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name().trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
