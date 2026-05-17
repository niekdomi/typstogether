import { TbOutlinePlus } from "solid-icons/tb";

import { Button } from "../../components/ui/button";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "../../components/ui/tabs";

export type Tab = "owned" | "shared";

interface TabsBarProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  ownedCount: number;
  sharedCount: number;
  onNewProject: () => void;
}

export default function TabsBar(props: TabsBarProps) {
  return (
    <div class="border-border/60 flex items-center justify-between border-b pb-6">
      <Tabs
        value={props.tab}
        onChange={(v) => {
          props.onTab(v as Tab);
        }}
      >
        <TabsList>
          <TabsTrigger value="owned">
            Yours <span class="text-muted-foreground ml-1.5">{props.ownedCount}</span>
          </TabsTrigger>
          <TabsTrigger value="shared">
            Shared with you <span class="text-muted-foreground ml-1.5">{props.sharedCount}</span>
          </TabsTrigger>
          <TabsIndicator />
        </TabsList>
      </Tabs>
      <Button onClick={props.onNewProject}>
        <TbOutlinePlus size={14} />
        New project
      </Button>
    </div>
  );
}
