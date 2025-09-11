import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { X, Play, AlertTriangle, MapPin, Clock, Eye, UserX } from "lucide-react";
import type { AlertWithRelations } from "@shared/schema";

interface AlertModalProps {
  alert: AlertWithRelations;
  onClose: () => void;
  onMarkRead: () => void;
  onDeactivate: () => void;
}

export function AlertModal({ alert, onClose, onMarkRead, onDeactivate }: AlertModalProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTypeLabel = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDetectionMethods = (methods: string[]) => {
    return methods.map(method => 
      method.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="alert-modal">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Security Alert Details</DialogTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Alert Type</label>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getSeverityColor(alert.severity)}>
                  {alert.severity.toUpperCase()}
                </Badge>
                <p className="font-medium text-foreground">{getTypeLabel(alert.type)}</p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <p className="text-foreground font-medium mt-1">{alert.title}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Location</label>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-foreground">
                  {alert.camera ? `${alert.camera.name} - ${alert.camera.location}` : 'Unknown Location'}
                </p>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Time Detected</label>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            </div>
            
            {alert.metadata?.confidence && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Confidence Level</label>
                <p className="text-foreground font-medium mt-1">{alert.metadata.confidence}%</p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="text-foreground text-sm mt-1">{alert.message}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {alert.metadata?.detectionMethods && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Detection Method</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {formatDetectionMethods(alert.metadata.detectionMethods).map((method, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Evidence Clip</label>
              <Card className="mt-2">
                <CardContent className="p-4">
                  <div className="bg-muted rounded-lg h-32 flex items-center justify-center">
                    <div className="text-center">
                      <Play className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Video evidence available</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${alert.isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-sm">
                  {alert.isActive ? 'Active' : 'Inactive'} • {alert.isRead ? 'Read' : 'Unread'}
                </span>
              </div>
            </div>
            
            {alert.acknowledgedAt && alert.acknowledgedBy && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Acknowledged</label>
                <p className="text-foreground text-sm mt-1">
                  By {alert.acknowledgedBy} at {new Date(alert.acknowledgedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button 
            variant="destructive" 
            className="flex-1"
            onClick={() => {
              // Handle alert security action
              console.log('Alert security triggered');
            }}
            data-testid="button-alert-security"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alert Security
          </Button>
          
          {!alert.isRead && (
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={onMarkRead}
              data-testid="button-mark-read"
            >
              <Eye className="h-4 w-4 mr-2" />
              Mark as Read
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => {
              // Handle false positive
              console.log('Marked as false positive');
              onDeactivate();
            }}
            data-testid="button-false-positive"
          >
            <UserX className="h-4 w-4 mr-2" />
            False Positive
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
