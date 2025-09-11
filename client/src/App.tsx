import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "./lib/websocket";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "@/components/protected-route";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import LiveFeeds from "@/pages/live-feeds";
import Alerts from "@/pages/alerts";
import Offenders from "@/pages/offenders";
import Analytics from "@/pages/analytics";
import Network from "@/pages/network";
import Settings from "@/pages/settings";
import LoginPage from "@/pages/login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/live-feeds">
        <ProtectedRoute>
          <LiveFeeds />
        </ProtectedRoute>
      </Route>
      <Route path="/alerts">
        <ProtectedRoute>
          <Alerts />
        </ProtectedRoute>
      </Route>
      <Route path="/offenders">
        <ProtectedRoute>
          <Offenders />
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <Analytics />
        </ProtectedRoute>
      </Route>
      <Route path="/network">
        <ProtectedRoute>
          <Network />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <TooltipProvider>
            <div className="dark">
              <Toaster />
              <Router />
            </div>
          </TooltipProvider>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
