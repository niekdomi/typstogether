import { createContext, type JSX, useContext } from "solid-js";

import { type FileSidebarController, useFileSidebar } from "./use-file-sidebar";

const FileSidebarContext = createContext<FileSidebarController>();

export function FileSidebarProvider(props: { children: JSX.Element }) {
  const sb = useFileSidebar();
  return <FileSidebarContext.Provider value={sb}>{props.children}</FileSidebarContext.Provider>;
}

export function useFileSidebarController(): FileSidebarController {
  const ctx = useContext(FileSidebarContext);
  if (!ctx) throw new Error("useFileSidebarController must be used inside FileSidebarProvider");
  return ctx;
}
