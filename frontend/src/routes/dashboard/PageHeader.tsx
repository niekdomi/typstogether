import { TbOutlinePlus } from "solid-icons/tb";
import { Show, createSignal } from "solid-js";

interface PageHeaderProps {
  totalCount: number;
  creating: boolean;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  onSubmitCreate: (name: string) => void;
}

function NewProjectForm(props: { onCancel: () => void; onSubmit: (name: string) => void }) {
  const [name, setName] = createSignal("");
  return (
    <form
      class="new-inline"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name().trim();
        if (trimmed) props.onSubmit(trimmed);
      }}
    >
      <input
        autofocus
        type="text"
        placeholder="Project name"
        value={name()}
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <button type="submit" class="btn btn-primary" disabled={!name().trim()}>
        Create
      </button>
      <button
        type="button"
        class="btn"
        onClick={() => {
          setName("");
          props.onCancel();
        }}
      >
        Cancel
      </button>
    </form>
  );
}

export default function PageHeader(props: PageHeaderProps) {
  return (
    <div class="page-header">
      <div>
        <div class="mono detail">~/projects · {props.totalCount} repos</div>
        <h1 class="display">Projects.</h1>
      </div>
      <div class="actions">
        <button type="button" class="btn" disabled>
          <span class="mono">git</span>
          Clone repo
        </button>
        <button type="button" class="btn" disabled>
          Import .typ
        </button>
        <Show
          when={props.creating}
          fallback={
            <button type="button" class="btn btn-primary" onClick={props.onStartCreate}>
              <TbOutlinePlus size={14} />
              New project
            </button>
          }
        >
          <NewProjectForm onCancel={props.onCancelCreate} onSubmit={props.onSubmitCreate} />
        </Show>
      </div>
    </div>
  );
}
