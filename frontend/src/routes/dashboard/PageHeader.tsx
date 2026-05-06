import { TbOutlinePlus } from "solid-icons/tb";

interface PageHeaderProps {
  totalCount: number;
  onNewProject: () => void;
}

export default function PageHeader(props: PageHeaderProps) {
  return (
    <div class="page-header">
      <h1 class="display">Projects</h1>
      <button type="button" class="btn btn-primary" onClick={props.onNewProject}>
        <TbOutlinePlus size={14} />
        New project
      </button>
    </div>
  );
}
