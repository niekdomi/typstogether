import { TbOutlineX } from "solid-icons/tb";
import { For, Match, Switch, createMemo, createResource, createSignal } from "solid-js";

import Modal from "../../components/Modal";
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
    <Modal open={props.open} onClose={props.onClose} labelledBy="new-project-title" size="wide">
      <header class="modal-header">
        <h2 id="new-project-title" class="display modal-title">
          New project
        </h2>
        <button type="button" class="modal-close" onClick={props.onClose} aria-label="Close">
          <TbOutlineX size={16} />
        </button>
      </header>
      <form
        class="modal-body"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name().trim();
          if (trimmed) props.onSubmit(trimmed);
        }}
      >
        <label class="modal-field">
          <span class="smallcaps">Name</span>
          <input
            autofocus
            type="text"
            placeholder="My document"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <div class="template-section">
          <span class="smallcaps">Template</span>
          <div class="template-chips">
            <button
              type="button"
              class={`chip${category() === "all" ? " active" : ""}`}
              onClick={() => setCategory("all")}
            >
              all
            </button>
            <For each={categories()}>
              {(c) => (
                <button
                  type="button"
                  class={`chip${category() === c ? " active" : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              )}
            </For>
          </div>
          <hr class="template-divider" />
          <input
            type="text"
            class="template-search"
            placeholder="Search templates…"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
          <div class="template-grid">
            <button
              type="button"
              class={`template-card${template() === BLANK_ID ? " active" : ""}`}
              onClick={() => setTemplate(BLANK_ID)}
            >
              <div class="template-name">Blank</div>
              <div class="template-desc">Empty document.</div>
            </button>
            <Switch
              fallback={
                <For each={filtered()}>
                  {(t) => (
                    <button
                      type="button"
                      class={`template-card${template() === t.id ? " active" : ""}`}
                      onClick={() => setTemplate(t.id)}
                    >
                      <div class="template-name">{t.id}</div>
                      <div class="template-desc">{t.description || "No description."}</div>
                      <div class="template-meta mono">
                        v{t.version}
                        {t.categories.length > 0 ? ` · ${t.categories.join(", ")}` : ""}
                      </div>
                    </button>
                  )}
                </For>
              }
            >
              <Match when={templates.loading}>
                <div class="template-loading mono">Loading templates…</div>
              </Match>
              <Match when={templates.error !== undefined}>
                <div class="template-loading mono">Could not load templates.</div>
              </Match>
            </Switch>
          </div>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn" onClick={props.onClose}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={!name().trim()}>
            Create
          </button>
        </footer>
      </form>
    </Modal>
  );
}
