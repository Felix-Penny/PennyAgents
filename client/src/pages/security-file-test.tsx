// Security File Upload Test Page
// For testing the Object Storage integration
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SecurityFileUploader } from "@/components/ObjectUploader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Video, Camera, FileText, AlertTriangle, Upload, CheckCircle } from "lucide-react";
import type { UploadResult } from "@uppy/core";

interface EvidenceFile {
  objectPath: string;
  category: string;
  uploadedAt: string;
}

interface EvidenceResponse {
  evidenceFiles?: string[];
  totalFiles?: number;
  storeId?: string;
}

interface UploadResponse {
  uploadURL: string;
}

interface EvidenceUpdateResponse {
  objectPath: string;
}

export default function SecurityFileTest() {
  const { user } = useAuth();
  const [uploadStatus, setUploadStatus] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Test data for incidents (in a real implementation, this would come from the API)
  const mockIncidentId = "test-incident-123";
  const storeId = user?.storeId || "store-1";

  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/security/evidence/upload", {
        body: { category: "incident_evidence" }
      }) as unknown as UploadResponse;
      
      if (!response.uploadURL) {
        throw new Error("No upload URL received from server");
      }
      
      return {
        method: "PUT" as const,
        url: response.uploadURL,
      };
    } catch (error) {
      console.error("Failed to get upload parameters:", error);
      setUploadStatus({
        message: `Failed to get upload URL: ${error}`,
        type: "error"
      });
      throw error;
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    try {
      console.log("Upload completed:", result);
      
      if (result.successful && result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        const evidenceFileURL = uploadedFile.uploadURL;
        
        // Update evidence bundle via API
        const response = await apiRequest("PUT", "/api/security/evidence", {
          body: {
            evidenceFileURL,
            storeId,
            incidentId: mockIncidentId,
            category: "incident_evidence",
            description: "Test security evidence file"
          }
        }) as unknown as EvidenceUpdateResponse;
        
        setUploadStatus({
          message: `Security evidence uploaded successfully! File secured at: ${response.objectPath}`,
          type: "success"
        });
        
        // Invalidate evidence query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/security/incidents", mockIncidentId, "evidence"] });
      } else {
        throw new Error("Upload failed - no successful uploads");
      }
    } catch (error) {
      console.error("Upload completion error:", error);
      setUploadStatus({
        message: `Failed to process uploaded file: ${error}`,
        type: "error"
      });
    }
  };

  // Query for testing evidence retrieval
  const { data: evidenceData, isLoading: evidenceLoading } = useQuery<EvidenceResponse>({
    queryKey: ["/api/security/incidents", mockIncidentId, "evidence"],
    enabled: !!user?.id
  });

  if (!user) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please log in to test security file upload functionality.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-security-file-test">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-security-file-test">
            Security File Storage Test
          </h1>
          <p className="text-muted-foreground">
            Test the Object Storage integration for security evidence management
          </p>
        </div>
      </div>

      {/* Upload Status Alert */}
      {uploadStatus && (
        <Alert className={uploadStatus.type === "error" ? "border-red-500 bg-red-50" : "border-green-500 bg-green-50"}>
          {uploadStatus.type === "success" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={uploadStatus.type === "error" ? "text-red-700" : "text-green-700"}>
            {uploadStatus.message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Upload Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Security Evidence Upload
            </CardTitle>
            <CardDescription>
              Test uploading security evidence files with proper access controls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Store ID:</label>
                <Badge variant="outline" data-testid="badge-store-id">{storeId}</Badge>
              </div>
              <div>
                <label className="text-sm font-medium">Test Incident:</label>
                <Badge variant="outline" data-testid="badge-incident-id">{mockIncidentId}</Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              <SecurityFileUploader
                maxNumberOfFiles={3}
                maxFileSize={50 * 1024 * 1024} // 50MB for testing
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                category="incident_evidence"
                buttonClassName="w-full"
              >
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Upload Security Evidence
                </div>
              </SecurityFileUploader>
              
              <p className="text-sm text-muted-foreground">
                Supported: Images (JPG, PNG), Videos (MP4, AVI), Documents (PDF, TXT)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Evidence Files List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Evidence Files
            </CardTitle>
            <CardDescription>
              View uploaded security evidence for the test incident
            </CardDescription>
          </CardHeader>
          <CardContent>
            {evidenceLoading ? (
              <div className="text-sm text-muted-foreground">Loading evidence files...</div>
            ) : evidenceData?.evidenceFiles?.length ? (
              <div className="space-y-2" data-testid="list-evidence-files">
                {evidenceData.evidenceFiles.map((filePath: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-mono flex-1" data-testid={`evidence-file-${index}`}>
                      {filePath}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Protected
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground" data-testid="text-no-evidence">
                No evidence files uploaded yet. Use the upload button to test the integration.
              </div>
            )}
            
            {evidenceData && (
              <div className="mt-4 text-xs text-muted-foreground">
                Total Files: {evidenceData.totalFiles || 0} | Store: {evidenceData.storeId || 'Unknown'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Features Implemented</CardTitle>
          <CardDescription>
            Overview of security-specific object storage capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Video className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <h4 className="font-medium">Video Footage Storage</h4>
                <p className="text-sm text-muted-foreground">
                  Secure storage for security camera recordings and incident videos
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Camera className="h-5 w-5 text-green-600 mt-1" />
              <div>
                <h4 className="font-medium">Evidence Management</h4>
                <p className="text-sm text-muted-foreground">
                  Organized storage with ACL-based access control for sensitive evidence
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-purple-600 mt-1" />
              <div>
                <h4 className="font-medium">Access Control</h4>
                <p className="text-sm text-muted-foreground">
                  Store-level permissions with security agent role validation
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}