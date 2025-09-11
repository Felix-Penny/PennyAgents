import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "./lib/websocket";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import LiveFeeds from "@/pages/live-feeds";
import Alerts from "@/pages/alerts";
import Offenders from "@/pages/offenders";
import Analytics from "@/pages/analytics";
import Network from "@/pages/network";
import Settings from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/live-feeds" component={LiveFeeds} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/offenders" component={Offenders} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/network" component={Network} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <TooltipProvider>
          <div className="dark">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

export default App;
