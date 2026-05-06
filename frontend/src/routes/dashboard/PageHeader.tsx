import { TbOutlinePlus } from "solid-icons/tb";

import { Button } from "../../components/ui/button";

interface PageHeaderProps {
  totalCount: number;
  onNewProject: () => void;
}

export default function PageHeader(props: PageHeaderProps) {
  return (
    <div class="page-header">
      <h1 class="display">Projects</h1>
      <Button onClick={props.onNewProject}>
        <TbOutlinePlus size={14} />
        New project
      </Button>
    </div>
  );
}
