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
import StoreLoginPage from "./pages/store-login";
import PennyLoginPage from "./pages/penny-login";
import RepaymentLoginPage from "./pages/repayment-login";
import VideoTest from "./pages/video-test";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PortalSelectPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/store/login" component={StoreLoginPage} />
      <Route path="/penny/login" component={PennyLoginPage} />
      <Route path="/repayment/login" component={RepaymentLoginPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/live-feeds" component={LiveFeeds} />
      <ProtectedRoute path="/alerts" component={Alerts} />
      <ProtectedRoute path="/offenders" component={Offenders} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/network" component={Network} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/video-test" component={VideoTest} />
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
