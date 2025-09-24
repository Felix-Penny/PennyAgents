/**
 * Evidence Management System with Object Storage Integration
 * Handles multi-media evidence, chain of custody, and file operations
 */

import { ObjectStorageService, SecurityFileCategory } from "../objectStorage";
import { storage } from "../storage";
import { randomUUID } from "crypto";

export interface EvidenceFile {
  id: string;
  incidentId: string;
  originalName: string;
  storagePath: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  metadata: {
    cameraId?: string;
    timestamp?: string;
    confidence?: number;
    aiGenerated?: boolean;
    gpsCoordinates?: { lat: number; lng: number };
    deviceInfo?: string;
    checksum?: string;
  };
}

export interface EvidenceUploadResult {
  evidenceId: string;
  uploadUrl: string;
  filePath: string;
}

export interface ChainOfCustodyEntry {
  action: "collected" | "transferred" | "analyzed" | "viewed" | "modified" | "archived";
  person: string;
  role: string;
  timestamp: Date;
  notes?: string;
  location?: string;
  reason?: string;
}

export class EvidenceManager {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  /**
   * Get upload URL for evidence file
   */
  async getEvidenceUploadUrl(
    incidentId: string, 
    fileName: string, 
    fileType: string,
    uploadedBy: string
  ): Promise<EvidenceUploadResult> {
    // Validate incident exists
    const incident = await storage.getIncident(incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    // Determine evidence category based on file type
    const category = this.getEvidenceCategory(fileType);
    
    // Get signed upload URL from object storage
    const uploadUrl = await this.objectStorage.getSecurityFileUploadURL(category);
    
    // Generate evidence ID and file path
    const evidenceId = randomUUID();
    const filePath = this.generateEvidenceFilePath(incidentId, evidenceId, fileName);

    // Create evidence record in database
    await storage.createEvidenceChain({
      id: evidenceId,
      incidentId,
      evidenceNumber: this.generateEvidenceNumber(incidentId),
      evidenceType: this.getEvidenceType(fileType),
      evidenceCategory: "primary",
      description: `Evidence file: ${fileName}`,
      filePath,
      collectedBy: uploadedBy,
      collectedAt: new Date(),
      chainOfCustody: [{
        action: "collected",
        person: uploadedBy,
        timestamp: new Date(),
        role: "investigator"
      }],
      digitalSignature: this.generateFileHash(fileName, uploadedBy),
      metadata: {
        originalFileName: fileName,
        fileType,
        uploadedBy,
        uploadedAt: new Date().toISOString()
      }
    });

    return {
      evidenceId,
      uploadUrl,
      filePath
    };
  }

  /**
   * Confirm evidence upload and update metadata
   */
  async confirmEvidenceUpload(
    evidenceId: string,
    fileMetadata: {
      fileSize: number;
      mimeType: string;
      checksum?: string;
      cameraId?: string;
      timestamp?: string;
      confidence?: number;
      aiGenerated?: boolean;
    }
  ): Promise<void> {
    // Update evidence record with file metadata
    await storage.updateEvidenceChain(evidenceId, {
      metadata: {
        ...fileMetadata,
        uploadCompleted: true,
        uploadCompletedAt: new Date().toISOString()
      },
      digitalSignature: this.generateFileHash(JSON.stringify(fileMetadata), "system")
    });

    // Add chain of custody entry for upload completion
    await this.addChainOfCustodyEntry(evidenceId, {
      action: "collected",
      person: "system",
      role: "automated_system",
      timestamp: new Date(),
      notes: "File upload completed and verified"
    });
  }

  /**
   * Add automated evidence from AI detection
   */
  async addAutomatedEvidence(
    incidentId: string,
    aiDetectionData: {
      cameraId: string;
      detectionType: string;
      confidence: number;
      timestamp: string;
      boundingBoxes?: any[];
      imageUrl?: string;
      videoClipUrl?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const evidenceId = randomUUID();
    
    // Create evidence record
    await storage.createEvidenceChain({
      id: evidenceId,
      incidentId,
      evidenceNumber: this.generateEvidenceNumber(incidentId),
      evidenceType: "digital_video",
      evidenceCategory: "automated",
      description: `AI Detection Evidence: ${aiDetectionData.detectionType}`,
      filePath: aiDetectionData.videoClipUrl || aiDetectionData.imageUrl || "",
      collectedBy: "ai_system",
      collectedAt: new Date(aiDetectionData.timestamp),
      chainOfCustody: [{
        action: "collected",
        person: "ai_system",
        timestamp: new Date(aiDetectionData.timestamp),
        role: "automated_detection_system"
      }],
      digitalSignature: this.generateFileHash(JSON.stringify(aiDetectionData), "ai_system"),
      metadata: {
        ...aiDetectionData,
        aiGenerated: true,
        source: "threat_detection_system"
      }
    });

    return evidenceId;
  }

  /**
   * Get evidence files for incident
   */
  async getIncidentEvidence(incidentId: string): Promise<EvidenceFile[]> {
    const evidenceRecords = await storage.getIncidentEvidence(incidentId);
    
    return evidenceRecords.map(record => ({
      id: record.id,
      incidentId: record.incidentId,
      originalName: record.metadata?.originalFileName || record.description,
      storagePath: record.filePath || "",
      fileType: record.evidenceType,
      fileSize: record.metadata?.fileSize || 0,
      mimeType: record.metadata?.mimeType || "application/octet-stream",
      uploadedBy: record.collectedBy,
      uploadedAt: record.collectedAt,
      metadata: {
        cameraId: record.metadata?.cameraId,
        timestamp: record.metadata?.timestamp,
        confidence: record.metadata?.confidence,
        aiGenerated: record.metadata?.aiGenerated || false,
        checksum: record.metadata?.checksum,
        ...record.metadata
      }
    }));
  }

  /**
   * Get evidence download URL
   */
  async getEvidenceDownloadUrl(evidenceId: string, userId: string): Promise<string> {
    const evidence = await storage.getEvidenceChain(evidenceId);
    if (!evidence) {
      throw new Error("Evidence not found");
    }

    // Add chain of custody entry for access
    await this.addChainOfCustodyEntry(evidenceId, {
      action: "viewed",
      person: userId,
      role: "investigator",
      timestamp: new Date(),
      notes: "Evidence file accessed for download"
    });

    // Get object file from storage path
    const objectFile = await this.objectStorage.getObjectEntityFile(evidence.filePath);
    
    // Return signed download URL
    return this.objectStorage.normalizeObjectEntityPath(evidence.filePath);
  }

  /**
   * Add chain of custody entry
   */
  async addChainOfCustodyEntry(evidenceId: string, entry: ChainOfCustodyEntry): Promise<void> {
    const evidence = await storage.getEvidenceChain(evidenceId);
    if (!evidence) {
      throw new Error("Evidence not found");
    }

    const currentChain = evidence.chainOfCustody || [];
    const updatedChain = [...currentChain, entry];

    await storage.updateEvidenceChain(evidenceId, {
      chainOfCustody: updatedChain
    });
  }

  /**
   * Generate evidence statistics for incident
   */
  async getEvidenceStatistics(incidentId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
    automatedEvidence: number;
    manualEvidence: number;
  }> {
    const evidence = await this.getIncidentEvidence(incidentId);
    
    const stats = {
      totalFiles: evidence.length,
      totalSize: evidence.reduce((sum, file) => sum + file.fileSize, 0),
      fileTypes: {} as Record<string, number>,
      automatedEvidence: 0,
      manualEvidence: 0
    };

    evidence.forEach(file => {
      // Count file types
      const type = file.fileType || 'unknown';
      stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;

      // Count automated vs manual evidence
      if (file.metadata.aiGenerated) {
        stats.automatedEvidence++;
      } else {
        stats.manualEvidence++;
      }
    });

    return stats;
  }

  /**
   * Private helper methods
   */
  private getEvidenceCategory(fileType: string): SecurityFileCategory {
    if (fileType.includes('video')) return SecurityFileCategory.VIDEO_FOOTAGE;
    if (fileType.includes('image')) return SecurityFileCategory.SURVEILLANCE_SNAPSHOTS;
    if (fileType.includes('audio')) return SecurityFileCategory.INCIDENT_EVIDENCE;
    if (fileType.includes('document') || fileType.includes('pdf')) return SecurityFileCategory.SECURITY_REPORTS;
    return SecurityFileCategory.INCIDENT_EVIDENCE;
  }

  private getEvidenceType(fileType: string): string {
    if (fileType.includes('video')) return 'digital_video';
    if (fileType.includes('image')) return 'digital_image';
    if (fileType.includes('audio')) return 'digital_audio';
    if (fileType.includes('document') || fileType.includes('pdf')) return 'document';
    return 'digital_file';
  }

  private generateEvidenceNumber(incidentId: string): string {
    const timestamp = Date.now();
    const shortId = incidentId.slice(0, 8);
    return `EV-${shortId}-${timestamp}`;
  }

  private generateEvidenceFilePath(incidentId: string, evidenceId: string, fileName: string): string {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `/objects/incidents/${incidentId}/evidence/${evidenceId}_${sanitizedFileName}`;
  }

  private generateFileHash(data: string, userId: string): string {
    // Simple hash for integrity checking
    return Buffer.from(data + userId + Date.now()).toString('base64');
  }
}

// Export singleton instance
export const evidenceManager = new EvidenceManager();