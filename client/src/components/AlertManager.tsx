import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AlertPopup, AlertPopupData } from "./AlertPopup";
import { useWebSocket as useWebSocketProvider } from "@/lib/websocket";

export interface AlertManagerProps {
  maxConcurrentAlerts?: number;
  soundEnabled?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center";
  onAlertAction?: (action: string, alertId: string, data?: any) => void;
}

export interface AlertFilters {
  severity?: string[];
  types?: string[];
  cameras?: string[];
  areas?: string[];
}

export interface AlertSubscriptionPreferences {
  maxAlertsPerMinute?: number;
  suppressLowSeverity?: boolean;
  onlyAssignedAlerts?: boolean;
  pushNotifications?: boolean;
}

export function AlertManager({ 
  maxConcurrentAlerts = 3, 
  soundEnabled = true, 
  position = "top-right",
  onAlertAction
}: AlertManagerProps) {
  const [activeAlerts, setActiveAlerts] = useState<AlertPopupData[]>([]);
  const [alertFilters, setAlertFilters] = useState<AlertFilters>({});
  const [preferences, setPreferences] = useState<AlertSubscriptionPreferences>({
    maxAlertsPerMinute: 10,
    suppressLowSeverity: false,
    onlyAssignedAlerts: false,
    pushNotifications: true
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { socket, isConnected, sendMessage } = useWebSocketProvider();

  // Subscribe to alerts on connection
  useEffect(() => {
    if (socket && isConnected && user?.storeId && !isSubscribed) {
      console.log("Subscribing to alerts for store:", user.storeId);
      
      sendMessage({
        type: 'subscribe_alerts',
        filters: alertFilters,
        preferences: preferences
      });
      
      setIsSubscribed(true);
    }
  }, [socket, isConnected, user?.storeId, isSubscribed, alertFilters, preferences, sendMessage]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (socket && isConnected) {
      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'alert_notification':
              handleNewAlert(message.alert, message.snapshot);
              break;
              
            case 'alert_acknowledgment':
              handleAlertAcknowledgment(message.alertId, message.acknowledgedBy);
              break;
              
            case 'alert_escalation':
              handleAlertEscalation(message.alertId, message.newSeverity);
              break;
              
            case 'alert_subscription_confirmed':
              console.log("Alert subscription confirmed:", message.subscription);
              toast({
                title: "Alert Subscription Active",
                description: "You will receive real-time security alerts",
              });
              break;
              
            case 'alert_unsubscription_confirmed':
              setIsSubscribed(false);
              console.log("Alert subscription cancelled");
              break;
              
            case 'alert_filters_updated':
              console.log("Alert filters updated:", message.filters);
              break;
              
            case 'bulk_acknowledgment_confirmed':
              console.log("Bulk acknowledgment confirmed:", message);
              break;
              
            default:
              // Let other components handle their message types
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.addEventListener('message', handleMessage);
      
      return () => {
        socket.removeEventListener('message', handleMessage);
      };
    }
  }, [socket, isConnected, toast]);

  const handleNewAlert = useCallback((alert: any, snapshot?: string) => {
    console.log("Received new alert:", alert);
    
    // Transform backend alert to popup format
    const popupAlert: AlertPopupData = {
      id: alert.id,
      title: alert.title || "Security Alert",
      message: alert.message || "A security event has been detected",
      severity: alert.severity || "medium",
      priority: alert.priority || "normal",
      type: alert.type || "security_alert",
      cameraId: alert.cameraId,
      location: alert.location,
      metadata: alert.metadata,
      snapshot: snapshot,
      createdAt: alert.createdAt || new Date().toISOString(),
      responseTime: alert.responseTime,
      actionTaken: false
    };

    // Check if we already have this alert
    setActiveAlerts(current => {
      const exists = current.some(existing => existing.id === popupAlert.id);
      if (exists) {
        return current;
      }

      // Limit concurrent alerts
      const newAlerts = [popupAlert, ...current].slice(0, maxConcurrentAlerts);
      return newAlerts;
    });

    // Show toast notification for immediate awareness
    toast({
      title: `${alert.severity?.toUpperCase()} Security Alert`,
      description: alert.title || "A new security alert has been detected",
      variant: alert.severity === "critical" || alert.severity === "high" ? "destructive" : "default",
    });

  }, [maxConcurrentAlerts, toast]);

  const handleAlertAcknowledgment = useCallback((alertId: string, acknowledgedBy: string) => {
    setActiveAlerts(current => 
      current.filter(alert => alert.id !== alertId)
    );
    
    toast({
      title: "Alert Acknowledged",
      description: `Alert has been acknowledged by ${acknowledgedBy}`,
    });
  }, [toast]);

  const handleAlertEscalation = useCallback((alertId: string, newSeverity: string) => {
    setActiveAlerts(current => 
      current.map(alert => 
        alert.id === alertId 
          ? { ...alert, severity: newSeverity as any, priority: newSeverity === "critical" ? "immediate" : "urgent" }
          : alert
      )
    );
    
    toast({
      title: "Alert Escalated",
      description: `Alert has been escalated to ${newSeverity.toUpperCase()} severity`,
      variant: "destructive",
    });
  }, [toast]);

  const handleAcknowledgeAlert = useCallback((alertId: string, notes?: string) => {
    console.log("Acknowledging alert:", alertId, notes);
    
    if (socket && isConnected) {
      sendMessage({
        type: 'acknowledge_alert',
        alertId,
        notes
      });
    }

    onAlertAction?.('acknowledge', alertId, { notes });
  }, [socket, isConnected, sendMessage, onAlertAction]);

  const handleDismissAlert = useCallback((alertId: string, reason?: string) => {
    console.log("Dismissing alert:", alertId, reason);
    
    if (socket && isConnected) {
      sendMessage({
        type: 'dismiss_alert',
        alertId,
        reason
      });
    }

    onAlertAction?.('dismiss', alertId, { reason });
  }, [socket, isConnected, sendMessage, onAlertAction]);

  const handleEscalateAlert = useCallback((alertId: string, newSeverity: string, reason?: string) => {
    console.log("Escalating alert:", alertId, newSeverity, reason);
    
    if (socket && isConnected) {
      sendMessage({
        type: 'escalate_alert',
        alertId,
        newSeverity,
        reason
      });
    }

    onAlertAction?.('escalate', alertId, { newSeverity, reason });
  }, [socket, isConnected, sendMessage, onAlertAction]);

  const handleViewCamera = useCallback((cameraId: string) => {
    console.log("Viewing camera:", cameraId);
    // Navigate to live feeds page with specific camera
    // This would typically use the router to navigate
    onAlertAction?.('view_camera', cameraId);
  }, [onAlertAction]);

  const handleCloseAlert = useCallback((alertId: string) => {
    setActiveAlerts(current => 
      current.filter(alert => alert.id !== alertId)
    );
  }, []);

  const updateAlertFilters = useCallback((newFilters: AlertFilters) => {
    setAlertFilters(newFilters);
    
    if (socket && isConnected && isSubscribed) {
      sendMessage({
        type: 'update_alert_filters',
        filters: newFilters
      });
    }
  }, [socket, isConnected, isSubscribed, sendMessage]);

  const updatePreferences = useCallback((newPreferences: AlertSubscriptionPreferences) => {
    setPreferences(newPreferences);
    
    // Re-subscribe with new preferences
    if (socket && isConnected) {
      sendMessage({
        type: 'unsubscribe_alerts'
      });
      
      setTimeout(() => {
        sendMessage({
          type: 'subscribe_alerts',
          filters: alertFilters,
          preferences: newPreferences
        });
      }, 100);
    }
  }, [socket, isConnected, alertFilters, sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket && isConnected && isSubscribed) {
        sendMessage({
          type: 'unsubscribe_alerts'
        });
      }
    };
  }, [socket, isConnected, isSubscribed, sendMessage]);

  return (
    <>
      {/* Render active alert popups */}
      {activeAlerts.map((alert, index) => (
        <div 
          key={alert.id}
          style={{
            // Stack alerts with offset
            transform: `translateY(${index * 20}px)`,
            zIndex: 50 - index
          }}
        >
          <AlertPopup
            alert={alert}
            onAcknowledge={handleAcknowledgeAlert}
            onDismiss={handleDismissAlert}
            onEscalate={handleEscalateAlert}
            onViewCamera={handleViewCamera}
            onClose={() => handleCloseAlert(alert.id)}
            soundEnabled={soundEnabled && index === 0} // Only play sound for first alert
            position={position}
            autoCloseTimeout={alert.severity === "low" ? 30 : alert.severity === "medium" ? 60 : 0}
          />
        </div>
      ))}
      
      {/* Public API for external components */}
      <div style={{ display: 'none' }}>
        <div data-alert-manager-api="true" data-methods={JSON.stringify({
          updateFilters: updateAlertFilters,
          updatePreferences: updatePreferences,
          activeAlertsCount: activeAlerts.length,
          isSubscribed: isSubscribed
        })} />
      </div>
    </>
  );
}

export default AlertManager;