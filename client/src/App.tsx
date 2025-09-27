import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "@/lib/websocket";
import { AuthProvider } from "@/hooks/use-auth";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { ProtectedRoute } from "@/lib/protected-route";
import AlertManager from "@/components/AlertManager";
import NotFound from "./pages/not-found";
import Dashboard from "./pages/dashboard";
import FinanceDashboard from "./pages/finance-dashboard";
import SalesDashboard from "./pages/sales-dashboard";
import OperationsDashboard from "./pages/operations-dashboard";
import HRDashboard from "./pages/hr-dashboard";
import LiveFeeds from "./pages/live-feeds";
import Alerts from "./pages/alerts";
import Incidents from "./pages/incidents";
import IncidentDetails from "./pages/incident-details";
import Offenders from "./pages/offenders";
import Analytics from "./pages/analytics";
import PredictiveAnalytics from "./pages/predictive-analytics";
import Network from "./pages/network";
import Settings from "./pages/settings";
import LoginPage from "./pages/login";
import PortalSelectPage from "./pages/portal-select";
import PlatformDashboard from "./pages/platform-dashboard";
import PennyDashboard from "./pages/penny-dashboard";
import RepaymentDashboard from "./pages/repayment-dashboard";
import VideoUpload from "./pages/video-upload";
import VideoTest from "./pages/video-test";
import FacialRecognitionDashboard from "./pages/facial-recognition";
import { LiveMonitoring } from "./components/LiveMonitoring";
import { AgentProtectedRoute } from "@/lib/agent-protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PortalSelectPage} />
      <Route path="/login" component={LoginPage} />
      <ProtectedRoute path="/platform" component={PlatformDashboard} />
      
      {/* Security Agent Default Route */}
      <Route path="/security">
        {() => <Redirect to="/security/dashboard" />}
      </Route>
      
      {/* Security Agent Routes */}
      <Route path="/security/:rest*">
        <AgentProtectedRoute agentId="security-agent" minimumRole="viewer">
          {/* Real-time Alert Manager for Security Personnel */}
          <AlertManager 
            soundEnabled={true} 
            position="top-right" 
            maxConcurrentAlerts={5}
            onAlertAction={(action, alertId, data) => {
              console.log(`Alert action: ${action} for alert ${alertId}`, data);
            }}
          />
          <ProtectedRoute path="/security/dashboard" component={Dashboard} permissions={["analytics:operational"]} />
          <ProtectedRoute path="/security/live-monitoring" component={LiveMonitoring} permissions={["cameras:view"]} />
          <ProtectedRoute path="/security/live-feeds" component={LiveFeeds} permissions={["cameras:view"]} />
          <ProtectedRoute path="/security/alerts" component={Alerts} permissions={["alerts:receive"]} />
          <ProtectedRoute path="/security/incidents" component={Incidents} permissions={["incidents:view", "incidents:create"]} requireAll={false} />
          <ProtectedRoute path="/security/incidents/:id" component={IncidentDetails} permissions={["incidents:view", "incidents:investigate"]} requireAll={false} />
          <ProtectedRoute path="/security/offenders" component={Offenders} permissions={["incidents:view", "analytics:operational"]} requireAll={false} />
          <ProtectedRoute path="/security/analytics" component={Analytics} permissions={["analytics:operational", "analytics:executive"]} requireAll={false} />
          <ProtectedRoute path="/security/predictive-analytics" component={PredictiveAnalytics} permissions={["analytics:operational"]} />
          <ProtectedRoute path="/security/facial-recognition" component={FacialRecognitionDashboard} permissions={["analytics:operational", "facial_recognition:view"]} requireAll={false} />
          <ProtectedRoute path="/security/network" component={Network} permissions={["system:configure"]} />
          <ProtectedRoute path="/security/settings" component={Settings} permissions={["system:configure", "users:edit"]} requireAll={false} />
          <ProtectedRoute path="/security/video-upload" component={VideoUpload} permissions={["evidence:upload"]} />
          <ProtectedRoute path="/security/video-test" component={VideoTest} permissions={["cameras:view", "cameras:control"]} requireAll={false} />
        </AgentProtectedRoute>
      </Route>
      
      {/* Finance Agent Routes */}
      <Route path="/finance">
        <AgentProtectedRoute agentId="finance" minimumRole="viewer">
          <FinanceDashboard />
        </AgentProtectedRoute>
      </Route>
      
      {/* Sales Agent Routes */}
      <Route path="/sales">
        <AgentProtectedRoute agentId="sales" minimumRole="viewer">
          <SalesDashboard />
        </AgentProtectedRoute>
      </Route>
      
      {/* Operations Agent Routes */}
      <Route path="/operations">
        <AgentProtectedRoute agentId="operations" minimumRole="viewer">
          <OperationsDashboard />
        </AgentProtectedRoute>
      </Route>
      
      {/* HR Agent Routes */}
      <Route path="/hr">
        <AgentProtectedRoute agentId="hr" minimumRole="viewer">
          <HRDashboard />
        </AgentProtectedRoute>
      </Route>
      
      {/* Cyber Security Agent Routes */}
      <Route path="/cyber-security">
        <AgentProtectedRoute agentId="cyber-security-agent" minimumRole="viewer">
          <Dashboard />
        </AgentProtectedRoute>
      </Route>
      
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
          <PermissionsProvider>
            <TooltipProvider>
              <div className="dark">
                <Toaster />
                <Router />
              </div>
            </TooltipProvider>
          </PermissionsProvider>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
