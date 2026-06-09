import { useColorMode } from "@kobalte/core/color-mode";
import { Navigate, Route, Router } from "@solidjs/router";
import { createEffect, onCleanup, onMount } from "solid-js";

import { Toaster } from "./components/ui/sonner";
import { editorTheme } from "./lib/editor-prefs";
import ProtectedRoute from "./ProtectedRoute";
import Dashboard from "./routes/dashboard/Dashboard";
import Login from "./routes/login/Login";
import { appBaseFor } from "./routes/project/editor-theme";
import Project from "./routes/project/Project";
import RedeemInvite from "./routes/RedeemInvite";

// A file dropped outside a real dropzone otherwise makes the browser navigate to
// it (opening the file and blowing away the editor).
const swallowFileDrop = (e: DragEvent) => {
  if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
};

export default function App() {
  // The chosen theme drives the whole app: its base colors recolor the chrome
  // (set --background / --foreground; styles.css derives the rest) and its
  // polarity flips light/dark. Applied at the root so the dashboard, dialogs,
  // and editor all stay in sync.
  const { setColorMode } = useColorMode();
  createEffect(() => {
    const b = appBaseFor(editorTheme());
    const root = document.documentElement;
    root.style.setProperty("--background", b.bg);
    root.style.setProperty("--foreground", b.fg);
    setColorMode(b.dark ? "dark" : "light");
  });

  onMount(() => {
    globalThis.addEventListener("dragover", swallowFileDrop);
    globalThis.addEventListener("drop", swallowFileDrop);
    onCleanup(() => {
      globalThis.removeEventListener("dragover", swallowFileDrop);
      globalThis.removeEventListener("drop", swallowFileDrop);
    });
  });

  return (
    <>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/" component={ProtectedRoute}>
          <Route path="/" component={() => <Navigate href="/dashboard" />} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/project/:id" component={Project} />
          <Route path="/invite/:token" component={RedeemInvite} />
        </Route>
      </Router>
      <Toaster />
    </>
  );
}
