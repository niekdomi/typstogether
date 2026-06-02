import { TbOutlinePlus } from "solid-icons/tb";

import { Button } from "../../components/ui/button";

interface DashboardHeaderProps {
  onNewProject: () => void;
}

export default function DashboardHeader(props: DashboardHeaderProps) {
  return (
    <div class="border-border/60 flex items-center justify-end border-b pb-6">
      <Button onClick={props.onNewProject}>
        <TbOutlinePlus size={14} />
        New project
      </Button>
    </div>
  );
}
