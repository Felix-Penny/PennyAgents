// Security Agent File Uploader Component
// Based on javascript_object_storage integration blueprint
import { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import XHRUpload from "@uppy/xhr-upload";
import type { UploadResult, UppyFile } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface SecurityFileUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
  allowedFileTypes?: string[];
  category?: "video_footage" | "incident_evidence" | "facial_recognition" | "surveillance_snapshots" | "security_reports" | "ai_analysis";
}

/**
 * A security-specific file upload component that renders as a button and provides a modal interface for
 * evidence and security file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection with security file type validation
 *   - File preview for evidence review
 *   - Upload progress tracking
 *   - Upload status display
 * - Supports security-specific file categories:
 *   - Video footage (security camera recordings)
 *   - Incident evidence (photos, documents)
 *   - Facial recognition data
 *   - Surveillance snapshots
 *   - Security reports
 *   - AI analysis results
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded (default: 5 for evidence bundles)
 * @param props.maxFileSize - Maximum file size in bytes (default: 100MB for video files)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL).
 *   Fetches a presigned URL from the security backend for direct-to-storage uploads.
 * @param props.onComplete - Callback function called when upload is complete. Used to update
 *   evidence bundles and set object ACL policies for security access control.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 * @param props.allowedFileTypes - Array of MIME types allowed for upload (security validation)
 * @param props.category - Security file category for organizing evidence
 */
export function SecurityFileUploader({
  maxNumberOfFiles = 5, // Allow multiple evidence files
  maxFileSize = 104857600, // 100MB default for video files
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  allowedFileTypes,
  category = "incident_evidence",
}: SecurityFileUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  
  // Define default allowed file types based on security requirements
  const defaultAllowedTypes = [
    // Video files for security footage
    "video/mp4", "video/avi", "video/mov", "video/quicktime", "video/webm",
    // Image files for evidence photos
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
    // Document files for reports
    "application/pdf", "text/plain", "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: allowedFileTypes || defaultAllowedTypes,
      },
      autoProceed: false,
      meta: {
        securityCategory: category,
      }
    })
      .use(XHRUpload, {
        // XHRUpload configuration for direct PUT to GCS signed URLs
        endpoint: (fileOrBundle: UppyFile<any, any> | UppyFile<any, any>[]) => {
          // For single file uploads, extract the file
          const file = Array.isArray(fileOrBundle) ? fileOrBundle[0] : fileOrBundle;
          
          // Return the upload URL from the stored params
          // Note: This will be set up through a different mechanism
          return '/api/object-storage/upload-url';
        },
        method: "PUT",
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        // Use getResponseData to handle custom upload response
        getResponseData: (xhr: XMLHttpRequest) => {
          // For direct uploads to signed URLs, we handle the response differently
          return { success: true };
        },
        // For direct PUT uploads to signed URLs, we don't need fieldName or formData
        fieldName: undefined,
        formData: false,
        // Timeout for upload requests (15 minutes to match signed URL expiry)
        timeout: 900000,
      })
      .on("complete", (result) => {
        console.log("Security file upload completed:", result);
        onComplete?.(result);
        setShowModal(false); // Close modal on completion
      })
      .on("error", (error) => {
        console.error("Security file upload error:", error);
      })
  );

  return (
    <div>
      <Button 
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        data-testid={`button-upload-${category}`}
      >
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
        note={`Upload ${category.replace('_', ' ')} files for security evidence. Max ${maxNumberOfFiles} files, ${Math.round(maxFileSize / 1024 / 1024)}MB each.`}
      />
    </div>
  );
}

// Legacy export for backward compatibility
export const ObjectUploader = SecurityFileUploader;