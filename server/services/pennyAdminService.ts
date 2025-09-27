import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import s3StorageService from './s3StorageService';

interface IncidentEvidence {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  filePath: string;
  fileName: string;
  timestamp: Date;
  cameraId?: string;
  description?: string;
  confidence?: number;
  metadata?: any;
}

interface OffenderProfile {
  id: string;
  detectedFaces?: Array<{
    confidence: number;
    boundingBox: any;
    imageUrl: string;
  }>;
  behaviorPatterns?: Array<{
    type: string;
    confidence: number;
    description: string;
  }>;
  gaitSignature?: {
    features: number[];
    confidence: number;
  };
  firstSeen: Date;
  lastSeen: Date;
  totalDetections: number;
  locations: string[];
}

interface EvidencePackage {
  incidentId: string;
  timestamp: Date;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: IncidentEvidence[];
  offenderProfiles: OffenderProfile[];
  aiAnalysis: {
    threatAssessment: string;
    confidence: number;
    behaviorAnalysis: string;
    recommendations: string[];
  };
  storeInfo: {
    name: string;
    address: string;
    managerId: string;
    contactInfo: string;
  };
}

interface SubmissionResult {
  success: boolean;
  submissionId?: string;
  trackingNumber?: string;
  estimatedProcessingTime?: string;
  error?: string;
  message?: string;
}

interface NetworkSubmission {
  packageId: string;
  offenderNetworkId?: string;
  similarCases?: Array<{
    caseId: string;
    similarity: number;
    location: string;
    timestamp: Date;
  }>;
  riskAssessment: {
    publicSafety: 'low' | 'medium' | 'high' | 'critical';
    recurrence: 'unlikely' | 'possible' | 'likely' | 'certain';
    escalation: 'none' | 'minor' | 'moderate' | 'severe';
  };
}

class PennyAdminService {
  private apiUrl: string;
  private apiKey: string;
  private webhookSecret: string;
  private autoSubmitEnabled: boolean;
  private evidenceThreshold: 'low' | 'medium' | 'high' | 'critical';
  private logger: winston.Logger;
  private packageQueue: Map<string, EvidencePackage>;
  private processingTimeout: number;

  constructor() {
    this.apiUrl = process.env.PENNY_ADMIN_API_URL || 'https://api.pennyadmin.com';
    this.apiKey = process.env.PENNY_ADMIN_API_KEY || '';
    this.webhookSecret = process.env.PENNY_ADMIN_WEBHOOK_SECRET || '';
    this.autoSubmitEnabled = process.env.PENNY_ADMIN_AUTO_SUBMIT === 'true';
    this.evidenceThreshold = (process.env.PENNY_ADMIN_EVIDENCE_THRESHOLD as any) || 'high';
    this.processingTimeout = 30000; // 30 seconds
    this.packageQueue = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/penny-admin.log' })
      ]
    });
  }

  async createEvidencePackage(incidentData: {
    incidentId: string;
    timestamp: Date;
    location: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    storeInfo: EvidencePackage['storeInfo'];
  }): Promise<{ success: boolean; packageId?: string; error?: string }> {
    try {
      const packageId = `pkg_${incidentData.incidentId}_${Date.now()}`;

      const evidencePackage: EvidencePackage = {
        ...incidentData,
        evidence: [],
        offenderProfiles: [],
        aiAnalysis: {
          threatAssessment: 'Pending analysis',
          confidence: 0,
          behaviorAnalysis: 'Pending analysis',
          recommendations: []
        }
      };

      this.packageQueue.set(packageId, evidencePackage);

      this.logger.info('Evidence package created', { packageId, incidentId: incidentData.incidentId });

      return {
        success: true,
        packageId
      };

    } catch (error) {
      this.logger.error('Failed to create evidence package:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Package creation failed'
      };
    }
  }

  async addEvidence(packageId: string, evidence: Omit<IncidentEvidence, 'id'>): Promise<{ success: boolean; error?: string }> {
    try {
      const evidencePackage = this.packageQueue.get(packageId);
      if (!evidencePackage) {
        return {
          success: false,
          error: 'Evidence package not found'
        };
      }

      const evidenceItem: IncidentEvidence = {
        ...evidence,
        id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      evidencePackage.evidence.push(evidenceItem);

      this.logger.info('Evidence added to package', { packageId, evidenceId: evidenceItem.id, type: evidence.type });

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Failed to add evidence:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add evidence'
      };
    }
  }

  async addOffenderProfile(packageId: string, profile: Omit<OffenderProfile, 'id'>): Promise<{ success: boolean; error?: string }> {
    try {
      const evidencePackage = this.packageQueue.get(packageId);
      if (!evidencePackage) {
        return {
          success: false,
          error: 'Evidence package not found'
        };
      }

      const offenderProfile: OffenderProfile = {
        ...profile,
        id: `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      evidencePackage.offenderProfiles.push(offenderProfile);

      this.logger.info('Offender profile added to package', { packageId, profileId: offenderProfile.id });

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Failed to add offender profile:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add offender profile'
      };
    }
  }

  async updateAIAnalysis(packageId: string, analysis: EvidencePackage['aiAnalysis']): Promise<{ success: boolean; error?: string }> {
    try {
      const evidencePackage = this.packageQueue.get(packageId);
      if (!evidencePackage) {
        return {
          success: false,
          error: 'Evidence package not found'
        };
      }

      evidencePackage.aiAnalysis = analysis;

      this.logger.info('AI analysis updated for package', { packageId, confidence: analysis.confidence });

      // Auto-submit if conditions are met
      if (this.autoSubmitEnabled && this.shouldAutoSubmit(evidencePackage)) {
        await this.submitToNetwork(packageId);
      }

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Failed to update AI analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update AI analysis'
      };
    }
  }

  async submitToNetwork(packageId: string): Promise<SubmissionResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Penny Admin API not configured'
      };
    }

    try {
      const evidencePackage = this.packageQueue.get(packageId);
      if (!evidencePackage) {
        return {
          success: false,
          error: 'Evidence package not found'
        };
      }

      // Prepare evidence files for upload
      const evidenceFiles = await this.prepareEvidenceFiles(evidencePackage.evidence);
      
      // Create submission payload
      const submissionData = await this.createSubmissionPayload(evidencePackage);
      
      // Submit to Penny Admin API
      const submission = await this.submitToPennyAdmin(submissionData, evidenceFiles);

      if (submission.success) {
        // Remove from queue after successful submission
        this.packageQueue.delete(packageId);
        
        this.logger.info('Evidence package submitted successfully', {
          packageId,
          submissionId: submission.submissionId,
          trackingNumber: submission.trackingNumber
        });
      }

      return submission;

    } catch (error) {
      this.logger.error('Network submission failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed'
      };
    }
  }

  async submitToOffenderNetwork(packageId: string, offenderNetworkData: NetworkSubmission): Promise<SubmissionResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Penny Admin API not configured'
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/offender-network/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(offenderNetworkData)
      });

      if (!response.ok) {
        throw new Error(`Network submission failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      this.logger.info('Offender network submission successful', {
        packageId,
        networkId: result.networkId,
        matches: result.matches?.length || 0
      });

      return {
        success: true,
        submissionId: result.networkId,
        message: `Submitted to offender network with ${result.matches?.length || 0} potential matches`
      };

    } catch (error) {
      this.logger.error('Offender network submission failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network submission failed'
      };
    }
  }

  async getSubmissionStatus(submissionId: string): Promise<{
    success: boolean;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    message?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Penny Admin API not configured'
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/submissions/${submissionId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        status: result.status,
        progress: result.progress,
        message: result.message
      };

    } catch (error) {
      this.logger.error('Status check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed'
      };
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        return {
          success: false,
          error: 'Invalid webhook signature'
        };
      }

      const { type, data } = payload;

      switch (type) {
        case 'submission.completed':
          await this.handleSubmissionCompleted(data);
          break;
        case 'network.match_found':
          await this.handleNetworkMatch(data);
          break;
        case 'analysis.updated':
          await this.handleAnalysisUpdate(data);
          break;
        default:
          this.logger.warn('Unknown webhook type received:', type);
      }

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed'
      };
    }
  }

  private async prepareEvidenceFiles(evidence: IncidentEvidence[]): Promise<Array<{ buffer: Buffer; filename: string; contentType: string }>> {
    const files: Array<{ buffer: Buffer; filename: string; contentType: string }> = [];

    for (const item of evidence) {
      try {
        let buffer: Buffer;

        if (item.filePath.startsWith('http')) {
          // Download from URL
          const response = await fetch(item.filePath);
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else if (item.filePath.startsWith('/uploads/')) {
          // Get from storage service
          const result = await s3StorageService.downloadFile(item.filePath.replace('/uploads/', ''));
          if (result.success && result.buffer) {
            buffer = result.buffer;
          } else {
            continue;
          }
        } else {
          // Local file
          if (fs.existsSync(item.filePath)) {
            buffer = fs.readFileSync(item.filePath);
          } else {
            continue;
          }
        }

        files.push({
          buffer,
          filename: item.fileName,
          contentType: this.getContentType(item.type, item.fileName)
        });

      } catch (error) {
        this.logger.error('Failed to prepare evidence file:', {
          evidenceId: item.id,
          filePath: item.filePath,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return files;
  }

  private async createSubmissionPayload(evidencePackage: EvidencePackage): Promise<any> {
    return {
      incident: {
        id: evidencePackage.incidentId,
        timestamp: evidencePackage.timestamp.toISOString(),
        location: evidencePackage.location,
        severity: evidencePackage.severity,
        description: evidencePackage.description
      },
      store: evidencePackage.storeInfo,
      evidence: evidencePackage.evidence.map(item => ({
        id: item.id,
        type: item.type,
        filename: item.fileName,
        timestamp: item.timestamp.toISOString(),
        cameraId: item.cameraId,
        description: item.description,
        confidence: item.confidence,
        metadata: item.metadata
      })),
      offenders: evidencePackage.offenderProfiles,
      analysis: evidencePackage.aiAnalysis,
      metadata: {
        submissionTime: new Date().toISOString(),
        version: '1.0',
        source: 'PennyProtect'
      }
    };
  }

  private async submitToPennyAdmin(submissionData: any, evidenceFiles: Array<{ buffer: Buffer; filename: string; contentType: string }>): Promise<SubmissionResult> {
    try {
      const formData = new FormData();
      
      // Add submission data
      formData.append('submission', JSON.stringify(submissionData));
      
      // Add evidence files
      evidenceFiles.forEach((file, index) => {
        formData.append(`evidence_${index}`, file.buffer, {
          filename: file.filename,
          contentType: file.contentType
        });
      });

      const response = await fetch(`${this.apiUrl}/v1/submissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        body: formData as any
      });

      if (!response.ok) {
        throw new Error(`Submission failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        submissionId: result.submissionId,
        trackingNumber: result.trackingNumber,
        estimatedProcessingTime: result.estimatedProcessingTime,
        message: 'Evidence package submitted successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  private shouldAutoSubmit(evidencePackage: EvidencePackage): boolean {
    // Check evidence threshold
    const thresholdValues = { low: 1, medium: 2, high: 3, critical: 4 };
    const packageSeverityValue = thresholdValues[evidencePackage.severity];
    const thresholdValue = thresholdValues[this.evidenceThreshold];

    if (packageSeverityValue < thresholdValue) {
      return false;
    }

    // Check if we have sufficient evidence
    if (evidencePackage.evidence.length === 0) {
      return false;
    }

    // Check AI confidence
    if (evidencePackage.aiAnalysis.confidence < 0.7) {
      return false;
    }

    return true;
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!this.webhookSecret) {
      return true; // Skip verification if no secret configured
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch {
      return false;
    }
  }

  private async handleSubmissionCompleted(data: any): Promise<void> {
    this.logger.info('Submission completed:', data);
    // Handle completed submission (notify users, update database, etc.)
  }

  private async handleNetworkMatch(data: any): Promise<void> {
    this.logger.info('Network match found:', data);
    // Handle network match (alert authorities, escalate, etc.)
  }

  private async handleAnalysisUpdate(data: any): Promise<void> {
    this.logger.info('Analysis updated:', data);
    // Handle analysis update (update local records, notify users, etc.)
  }

  private getContentType(evidenceType: string, filename: string): string {
    const extension = path.extname(filename).toLowerCase();
    
    switch (evidenceType) {
      case 'image':
        switch (extension) {
          case '.jpg':
          case '.jpeg':
            return 'image/jpeg';
          case '.png':
            return 'image/png';
          case '.gif':
            return 'image/gif';
          default:
            return 'image/jpeg';
        }
      case 'video':
        switch (extension) {
          case '.mp4':
            return 'video/mp4';
          case '.avi':
            return 'video/avi';
          case '.mov':
            return 'video/quicktime';
          default:
            return 'video/mp4';
        }
      case 'audio':
        switch (extension) {
          case '.mp3':
            return 'audio/mpeg';
          case '.wav':
            return 'audio/wav';
          default:
            return 'audio/mpeg';
        }
      default:
        return 'application/octet-stream';
    }
  }

  async getQueuedPackages(): Promise<Array<{ packageId: string; evidence: EvidencePackage }>> {
    return Array.from(this.packageQueue.entries()).map(([packageId, evidence]) => ({
      packageId,
      evidence
    }));
  }

  async removeFromQueue(packageId: string): Promise<boolean> {
    return this.packageQueue.delete(packageId);
  }

  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  getConfiguration(): {
    apiUrl: string;
    autoSubmitEnabled: boolean;
    evidenceThreshold: string;
    queueSize: number;
    configured: boolean;
  } {
    return {
      apiUrl: this.apiUrl,
      autoSubmitEnabled: this.autoSubmitEnabled,
      evidenceThreshold: this.evidenceThreshold,
      queueSize: this.packageQueue.size,
      configured: this.isConfigured()
    };
  }
}

export default new PennyAdminService();