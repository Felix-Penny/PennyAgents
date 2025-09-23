import { Switch, Route } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "@/lib/websocket";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "./pages/not-found";
import Dashboard from "./pages/dashboard";
import LiveFeeds from "./pages/live-feeds";
import Alerts from "./pages/alerts";
import Offenders from "./pages/offenders";
import Analytics from "./pages/analytics";
import Network from "./pages/network";
import Settings from "./pages/settings";
import LoginPage from "./pages/login";
import PortalSelectPage from "./pages/portal-select";
import PlatformDashboard from "./pages/platform-dashboard";
import PennyDashboard from "./pages/penny-dashboard";
import RepaymentDashboard from "./pages/repayment-dashboard";
import VideoUpload from "./pages/video-upload";
import VideoTest from "./pages/video-test";
import { AgentProtectedRoute } from "@/lib/agent-protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PortalSelectPage} />
      <Route path="/login" component={LoginPage} />
      <ProtectedRoute path="/platform" component={PlatformDashboard} />
      
      {/* Security Agent Routes */}
      <Route path="/security">
        <AgentProtectedRoute agentId="security" minimumRole="viewer">
          <ProtectedRoute path="/dashboard" component={Dashboard} />
          <ProtectedRoute path="/live-feeds" component={LiveFeeds} />
          <ProtectedRoute path="/alerts" component={Alerts} />
          <ProtectedRoute path="/offenders" component={Offenders} />
          <ProtectedRoute path="/analytics" component={Analytics} />
          <ProtectedRoute path="/network" component={Network} />
          <ProtectedRoute path="/settings" component={Settings} />
          <ProtectedRoute path="/video-upload" component={VideoUpload} />
          <ProtectedRoute path="/video-test" component={VideoTest} />
        </AgentProtectedRoute>
      </Route>
      
      {/* Legacy routes for backward compatibility */}
      <AgentProtectedRoute agentId="security" minimumRole="viewer">
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/live-feeds" component={LiveFeeds} />
        <ProtectedRoute path="/alerts" component={Alerts} />
        <ProtectedRoute path="/offenders" component={Offenders} />
        <ProtectedRoute path="/analytics" component={Analytics} />
        <ProtectedRoute path="/network" component={Network} />
        <ProtectedRoute path="/settings" component={Settings} />
        <ProtectedRoute path="/video-upload" component={VideoUpload} />
        <ProtectedRoute path="/video-test" component={VideoTest} />
      </AgentProtectedRoute>
      
      <ProtectedRoute path="/penny/dashboard" component={PennyDashboard} allowedRoles={["penny_admin"]} />
      <ProtectedRoute path="/repayment/dashboard" component={RepaymentDashboard} allowedRoles={["offender"]} />
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
