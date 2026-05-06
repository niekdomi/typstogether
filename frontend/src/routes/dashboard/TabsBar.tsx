import { TbOutlinePlus } from "solid-icons/tb";

import { Button } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import type { Tab } from "./types";

interface TabsBarProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  ownedCount: number;
  sharedCount: number;
  onNewProject: () => void;
}

export default function TabsBar(props: TabsBarProps) {
  return (
    <div class="tabs-row">
      <Tabs
        value={props.tab}
        onChange={(v) => {
          props.onTab(v as Tab);
        }}
      >
        <TabsList>
          <TabsTrigger value="owned">
            Yours <span class="ml-1.5 text-muted-foreground">{props.ownedCount}</span>
          </TabsTrigger>
          <TabsTrigger value="shared">
            Shared with you <span class="ml-1.5 text-muted-foreground">{props.sharedCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Button onClick={props.onNewProject}>
        <TbOutlinePlus size={14} />
        New project
      </Button>
    </div>
  );
}
