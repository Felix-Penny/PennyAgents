import { useEffect, useRef } from "react";
import { useWebSocket as useWebSocketProvider } from "@/lib/websocket";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useWebSocket() {
  const { socket, isConnected, sendMessage } = useWebSocketProvider();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasSubscribed = useRef(false);

  useEffect(() => {
    if (socket && isConnected && !hasSubscribed.current) {
      // Subscribe to store updates (legacy)
      sendMessage({
        type: 'subscribe',
        storeId: 'store-1', // In real app, get from user context
        userId: 'current-user'
      });
      hasSubscribed.current = true;

      // Handle incoming messages
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'new_alert':
              // Legacy alert handling - invalidate alerts query to refresh data
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              
              // Show toast notification for legacy alerts
              toast({
                title: "New Security Alert",
                description: message.alert?.title || "A new security alert has been detected",
                variant: "destructive",
              });
              break;

            case 'alert_notification':
              // Real-time alert popup handled by AlertManager
              // Still refresh the alerts list for dashboard
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_acknowledgment':
              // Alert acknowledged - refresh alerts list
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_dismissal_confirmed':
              // Alert dismissed - refresh alerts list
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_escalation':
              // Alert escalated - refresh alerts list
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_resolution':
              // Alert resolved - refresh alerts list
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_bulk_acknowledgment':
              // Bulk acknowledgment - refresh alerts list  
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'bulk_acknowledgment_confirmed':
              // Legacy bulk operation - refresh alerts list
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_update':
              // Alert updated - refresh alerts list
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_status_change':
              // Alert status changed - refresh alerts list
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'new_detection':
              // Refresh incidents and alerts
              queryClient.invalidateQueries({ queryKey: ['/api/incidents'] });
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              
              toast({
                title: "Detection Alert",
                description: `New ${message.incident?.type || 'security'} incident detected`,
                variant: "destructive",
              });
              break;

            case 'camera_status_update':
              // Refresh camera data
              queryClient.invalidateQueries({ queryKey: ['/api/cameras'] });
              break;

            case 'camera_added':
              // Refresh camera list
              queryClient.invalidateQueries({ queryKey: ['/api/cameras'] });
              
              toast({
                title: "Camera Added",
                description: `New camera ${message.camera?.name} has been added`,
                variant: "default",
              });
              break;

            case 'incident_updated':
              // Refresh incidents
              queryClient.invalidateQueries({ queryKey: ['/api/incidents'] });
              break;

            case 'alert_acknowledged':
              // Legacy alert acknowledgment - refresh alerts
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            case 'alert_deactivated':
              // Legacy alert deactivation - refresh alerts
              queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
              break;

            // Real-time alert system message types - handled by AlertManager
            case 'alert_subscription_confirmed':
            case 'alert_unsubscription_confirmed':
            case 'alert_filters_updated':
            case 'alert_error':
              // These are handled by AlertManager component
              break;

            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    }

    return () => {
      if (socket) {
        socket.onmessage = null;
      }
    };
  }, [socket, isConnected, sendMessage, queryClient, toast]);

  return {
    isConnected,
    sendMessage
  };
}
