import type { Sort, Tab } from "./types";

interface TabsBarProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
  ownedCount: number;
  sharedCount: number;
}

export default function TabsBar(props: TabsBarProps) {
  return (
    <div class="tabs-row">
      <div class="tabs">
        <button
          type="button"
          class={`tab${props.tab === "owned" ? " active" : ""}`}
          onClick={() => {
            props.onTab("owned");
          }}
        >
          Yours <span class="count">{props.ownedCount}</span>
        </button>
        <button
          type="button"
          class={`tab${props.tab === "shared" ? " active" : ""}`}
          onClick={() => {
            props.onTab("shared");
          }}
        >
          Shared with you <span class="count">{props.sharedCount}</span>
        </button>
        <span class="tab inert">Templates</span>
        <span class="tab inert">Trash</span>
      </div>
      <div class="sort">
        <span class="smallcaps">sort by</span>
        <select
          value={props.sort}
          onChange={(e) => {
            props.onSort(e.currentTarget.value as Sort);
          }}
        >
          <option value="modified">last edited</option>
          <option value="title">title</option>
        </select>
      </div>
    </div>
  );
}
