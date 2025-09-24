import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Clock, User, FileText, Upload, Download, Eye, Edit, Save, AlertCircle, CheckCircle2, Timer, XCircle, Camera, File, Image, Video, MessageSquare, Activity } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";
type IncidentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface IncidentDetails {
  id: string;
  title: string;
  description: string;
  type: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  storeId: string;
  reportedBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  location?: {
    area: string;
    coordinates?: { x: number; y: number };
    floor?: string;
  };
  timeline: TimelineEvent[];
  evidence: EvidenceFile[];
  metadata?: Record<string, any>;
}

interface TimelineEvent {
  id: string;
  eventType: string;
  description: string;
  details: Record<string, any>;
  triggeredBy: string;
  timestamp: string;
}

interface EvidenceFile {
  id: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  metadata: {
    cameraId?: string;
    confidence?: number;
    aiGenerated?: boolean;
    checksum?: string;
  };
}

export default function IncidentDetails() {
  const [, params] = useRoute("/security/incidents/:id");
  const incidentId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("");
  const [assigneeUpdate, setAssigneeUpdate] = useState("");
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);

  // Fetch incident details
  const { data: incident, isLoading, refetch } = useQuery<IncidentDetails>({
    queryKey: ['/api/incidents', incidentId],
    queryFn: async (): Promise<IncidentDetails> => {
      if (!incidentId) throw new Error('No incident ID provided');
      const response = await fetch(`/api/incidents/${incidentId}`);
      if (!response.ok) throw new Error('Failed to fetch incident details');
      return response.json();
    },
    enabled: !!incidentId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update incident status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      return apiRequest('PATCH', `/api/incidents/${incidentId}`, { status, notes });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Incident status updated" });
      refetch();
      setStatusUpdate("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update status",
        variant: "destructive" 
      });
    },
  });

  // Assign incident mutation
  const assignMutation = useMutation({
    mutationFn: async ({ assignedTo, reason }: { assignedTo: string; reason?: string }) => {
      return apiRequest('POST', `/api/incidents/${incidentId}/assign`, { assignedTo, reason });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Incident assigned successfully" });
      refetch();
      setAssigneeUpdate("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to assign incident",
        variant: "destructive" 
      });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      return apiRequest('POST', `/api/incidents/${incidentId}/notes`, { note });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Note added to incident" });
      refetch();
      setNewNote("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add note",
        variant: "destructive" 
      });
    },
  });

  const getStatusIcon = (status: IncidentStatus) => {
    switch (status) {
      case "OPEN": return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "INVESTIGATING": return <Timer className="h-5 w-5 text-yellow-500" />;
      case "RESOLVED": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "CLOSED": return <XCircle className="h-5 w-5 text-gray-500" />;
      default: return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: IncidentPriority) => {
    switch (priority) {
      case "CRITICAL": return "bg-red-500 text-white";
      case "HIGH": return "bg-orange-500 text-white";
      case "MEDIUM": return "bg-yellow-500 text-black";
      case "LOW": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('video')) return <Video className="h-4 w-4" />;
    if (fileType.includes('image')) return <Image className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDateTime = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  const handleStatusUpdate = () => {
    if (statusUpdate) {
      updateStatusMutation.mutate({ status: statusUpdate });
    }
  };

  const handleAssignment = () => {
    if (assigneeUpdate) {
      assignMutation.mutate({ assignedTo: assigneeUpdate });
    }
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNoteMutation.mutate(newNote.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Incident Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            The requested incident could not be found.
          </p>
          <Button className="mt-4" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => window.history.back()} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(incident.status)}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="incident-title">
                {incident.title}
              </h1>
              <Badge className={getPriorityColor(incident.priority)} data-testid="incident-priority">
                {incident.priority}
              </Badge>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Incident ID: {incident.id}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setIsEditing(!isEditing)} data-testid="button-edit-incident">
            {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
            {isEditing ? "Save" : "Edit"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Incident Details */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <p className="text-gray-700 dark:text-gray-300" data-testid="incident-description">
                  {incident.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <p className="text-gray-700 dark:text-gray-300" data-testid="incident-type">
                    {incident.type.replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(incident.status)}
                    <span data-testid="incident-status">{incident.status}</span>
                  </div>
                </div>
              </div>

              {incident.location && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <p className="text-gray-700 dark:text-gray-300" data-testid="incident-location">
                      {incident.location.area}
                    </p>
                  </div>
                  {incident.location.floor && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Floor</label>
                      <p className="text-gray-700 dark:text-gray-300">
                        {incident.location.floor}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Created</label>
                  <p className="text-gray-700 dark:text-gray-300" data-testid="incident-created">
                    {formatDateTime(incident.createdAt)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Updated</label>
                  <p className="text-gray-700 dark:text-gray-300">
                    {formatDateTime(incident.updatedAt)}
                  </p>
                </div>
              </div>

              {incident.resolvedAt && (
                <div>
                  <label className="block text-sm font-medium mb-1">Resolved</label>
                  <p className="text-gray-700 dark:text-gray-300">
                    {formatDateTime(incident.resolvedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evidence Files */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Evidence ({incident.evidence.length})</span>
                <Dialog open={showEvidenceUpload} onOpenChange={setShowEvidenceUpload}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-upload-evidence">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Evidence
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Evidence</DialogTitle>
                    </DialogHeader>
                    <EvidenceUpload incidentId={incident.id} onUploadComplete={() => {
                      setShowEvidenceUpload(false);
                      refetch();
                    }} />
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incident.evidence.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No evidence files uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incident.evidence.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                      data-testid={`evidence-file-${file.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        {getFileIcon(file.fileType)}
                        <div>
                          <p className="font-medium">{file.originalName}</p>
                          <div className="text-sm text-gray-500 space-x-2">
                            <span>{formatFileSize(file.fileSize)}</span>
                            <span>•</span>
                            <span>{formatDateTime(file.uploadedAt)}</span>
                            <span>•</span>
                            <span>by {file.uploadedBy}</span>
                            {file.metadata.aiGenerated && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600">AI Generated</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" data-testid={`button-view-evidence-${file.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`button-download-evidence-${file.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions & Timeline */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Update */}
              <div>
                <label className="block text-sm font-medium mb-2">Update Status</label>
                <div className="flex space-x-2">
                  <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                    <SelectTrigger className="flex-1" data-testid="select-status-update">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    onClick={handleStatusUpdate}
                    disabled={!statusUpdate || updateStatusMutation.isPending}
                    data-testid="button-update-status"
                  >
                    Update
                  </Button>
                </div>
              </div>

              {/* Assignment */}
              <div>
                <label className="block text-sm font-medium mb-2">Assign To</label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="User ID or email"
                    value={assigneeUpdate}
                    onChange={(e) => setAssigneeUpdate(e.target.value)}
                    className="flex-1"
                    data-testid="input-assignee"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleAssignment}
                    disabled={!assigneeUpdate || assignMutation.isPending}
                    data-testid="button-assign"
                  >
                    Assign
                  </Button>
                </div>
                {incident.assignedTo && (
                  <p className="text-sm text-gray-500 mt-1">
                    Currently assigned to: {incident.assignedTo}
                  </p>
                )}
              </div>

              {/* Add Note */}
              <div>
                <label className="block text-sm font-medium mb-2">Add Note</label>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a note or comment..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    data-testid="textarea-note"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="w-full"
                    data-testid="button-add-note"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Timeline ({incident.timeline.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incident.timeline.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No timeline events yet</p>
              ) : (
                <div className="space-y-4">
                  {incident.timeline.slice(0, 10).map((event, index) => (
                    <div
                      key={event.id}
                      className="flex space-x-3"
                      data-testid={`timeline-event-${index}`}
                    >
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <Activity className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {event.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(event.timestamp)} • by {event.triggeredBy}
                        </p>
                        {event.eventType === 'note_added' && event.details.note && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            "{event.details.note}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {incident.timeline.length > 10 && (
                    <p className="text-sm text-gray-500 text-center">
                      ... and {incident.timeline.length - 10} more events
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Evidence Upload Component  
function EvidenceUpload({ incidentId, onUploadComplete }: { incidentId: string; onUploadComplete: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        // Get upload URL
        const uploadResponse = await apiRequest('POST', `/api/incidents/${incidentId}/evidence/upload-url`, {
          fileName: file.name,
          fileType: file.type
        });
        const uploadData = await uploadResponse.json();

        // Upload file
        await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        // Confirm upload
        await apiRequest('POST', `/api/evidence/${uploadData.evidenceId}/confirm-upload`, {
          fileSize: file.size,
          mimeType: file.type,
          checksum: 'placeholder' // In real implementation, calculate actual checksum
        });
      }

      toast({ title: "Success", description: `${files.length} evidence file(s) uploaded successfully` });
      onUploadComplete();
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to upload evidence",
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Select Evidence Files</label>
        <Input
          type="file"
          multiple
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx"
          data-testid="input-evidence-files"
        />
      </div>

      {files.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Selected Files ({files.length})</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <File className="h-4 w-4" />
                <span className="flex-1">{file.name}</span>
                <span className="text-gray-500">{formatFileSize(file.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => setFiles([])}>
          Clear
        </Button>
        <Button 
          onClick={handleUpload} 
          disabled={files.length === 0 || uploading}
          data-testid="button-upload-files"
        >
          {uploading ? "Uploading..." : "Upload Evidence"}
        </Button>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}