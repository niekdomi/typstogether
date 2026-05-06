import { Navigate, Route, Router } from "@solidjs/router";

import Toaster from "./components/Toaster";
import ProtectedRoute from "./ProtectedRoute";
import Dashboard from "./routes/dashboard/Dashboard";
import Login from "./routes/Login";
import Project from "./routes/Project";

export default function App() {
  return (
    <>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/" component={ProtectedRoute}>
          <Route path="/" component={() => <Navigate href="/dashboard" />} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/project/:id" component={Project} />
        </Route>
      </Router>
      <Toaster />
    </>
  );
}
