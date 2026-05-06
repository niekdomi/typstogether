import { TbOutlineX } from "solid-icons/tb";
import { For, createSignal } from "solid-js";

import Modal from "../../components/Modal";

interface Template {
  id: string;
  name: string;
  description: string;
}

const TEMPLATES: Template[] = [
  { id: "blank", name: "Blank", description: "Empty document." },
  { id: "article", name: "Article", description: "Academic article." },
  { id: "letter", name: "Letter", description: "Formal letter." },
  { id: "thesis", name: "Thesis", description: "Long-form document." },
];

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export default function NewProjectModal(props: NewProjectModalProps) {
  const [name, setName] = createSignal("");
  const [template, setTemplate] = createSignal("blank");

  return (
    <Modal open={props.open} onClose={props.onClose} labelledBy="new-project-title">
      <header class="modal-header">
        <h2 id="new-project-title" class="display modal-title">
          Create a project
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
        <div class="modal-field">
          <span class="smallcaps">Template</span>
          <div class="template-grid">
            <For each={TEMPLATES}>
              {(t) => (
                <button
                  type="button"
                  class={`template-card${template() === t.id ? " active" : ""}`}
                  onClick={() => setTemplate(t.id)}
                >
                  <div class="template-name">{t.name}</div>
                  <div class="template-desc">{t.description}</div>
                </button>
              )}
            </For>
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
