import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../db';
import { aiDetections, alerts, persons } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { WebSocketManager } from '../websocket/socketHandlers';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

export class AIAnalysisService {
  private pythonBridgePath: string;
  private wsManager: WebSocketManager;
  
  constructor(wsManager: WebSocketManager) {
    this.pythonBridgePath = path.join(__dirname, 'modal_bridge.py');
    this.wsManager = wsManager;
  }

  /**
   * Analyze a frame using Modal AI service via Python bridge
   */
  async analyzeFrame(cameraId: string, frameBytes: Buffer): Promise<any> {
    try {
      console.log(`[AI] Starting analysis for camera ${cameraId}`);
      
      // Get known offenders from database
      const knownFaces = await this.getKnownOffenders();
      console.log(`[AI] Found ${knownFaces.length} known offenders in database`);
      
      // Convert buffer to base64
      const frameBase64 = frameBytes.toString('base64');
      
      // Call Python bridge to Modal AI service
      const command = `python3 ${this.pythonBridgePath} analyze "${cameraId}" "${frameBase64}"`;
      console.log(`[AI] Executing Modal bridge command`);
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.warn(`[AI] Bridge warning: ${stderr}`);
      }
      
      // Parse response
      const aiResult = JSON.parse(stdout.trim());
      console.log(`[AI] Modal analysis complete:`, aiResult);
      
      // Process and store results
      const processedResult = await this.processAIResult(cameraId, aiResult, knownFaces);
      
      return processedResult;
      
    } catch (error) {
      console.error(`[AI] Analysis failed for camera ${cameraId}:`, error);
      
      // Return fallback result with error
      return this.createFallbackResult(cameraId, error);
    }
  }

  /**
   * Get known offenders with facial encodings from database
   */
  private async getKnownOffenders() {
    try {
      const knownPersons = await db.select().from(persons).where(eq(persons.isKnownOffender, true));
      
      return knownPersons.map(person => ({
        id: person.id,
        name: person.name,
        facial_encoding: person.facialEncoding,
        risk_level: person.riskLevel,
        last_seen: person.lastSeen,
        notes: person.notes
      }));
    } catch (error) {
      console.error('[AI] Failed to get known offenders:', error);
      return [];
    }
  }

  /**
   * Process AI analysis results and store in database
   */
  private async processAIResult(cameraId: string, aiResult: any, knownFaces: any[]): Promise<any> {
    try {
      // Store detections in database
      if (aiResult.detections) {
        await this.storeDetections(aiResult);
      }
      
      // Create alerts if threats detected
      if (aiResult.alerts && aiResult.alerts.length > 0) {
        await this.createAndBroadcastAlerts(cameraId, aiResult.alerts, aiResult);
      }
      
      // Broadcast real-time results to clients
      this.wsManager.broadcastToCamera(cameraId, 'analysis_result', {
        camera_id: cameraId,
        timestamp: aiResult.timestamp,
        detections: aiResult.detections,
        threat_level: aiResult.threat_level,
        processing_time: aiResult.processing_time_ms
      });
      
      return aiResult;
      
    } catch (error) {
      console.error(`[AI] Failed to process results for camera ${cameraId}:`, error);
      return aiResult;
    }
  }

  /**
   * Create fallback result when AI analysis fails
   */
  private createFallbackResult(cameraId: string, error: any): any {
    const fallbackResult = {
      camera_id: cameraId,
      timestamp: new Date().toISOString(),
      detections: {
        objects: [],
        faces: [],
        behaviors: [],
        gait_profiles: []
      },
      threat_level: 'unknown',
      alerts: [],
      error: error.message || 'AI analysis failed',
      processing_time_ms: 0
    };

    // Broadcast error to clients
    this.wsManager.broadcastToCamera(cameraId, 'analysis_error', {
      camera_id: cameraId,
      error: error.message || 'AI analysis failed',
      timestamp: new Date().toISOString()
    });

    return fallbackResult;
  }

  /**
   * Store AI detections in database
   */
  private async storeDetections(analysis: any): Promise<void> {
    try {
      const detections = analysis.detections;
      
      // Store object detections
      if (detections.objects && detections.objects.length > 0) {
        for (const obj of detections.objects) {
          await db.insert(aiDetections).values({
            cameraId: analysis.camera_id,
            timestamp: new Date(analysis.timestamp),
            detectionType: 'object',
            confidence: obj.confidence || 0,
            boundingBox: JSON.stringify(obj.bbox || {}),
            metadata: JSON.stringify(obj)
          });
        }
      }
      
      // Store face detections
      if (detections.faces && detections.faces.length > 0) {
        for (const face of detections.faces) {
          await db.insert(aiDetections).values({
            cameraId: analysis.camera_id,
            timestamp: new Date(analysis.timestamp),
            detectionType: 'face',
            confidence: face.confidence || 0,
            boundingBox: JSON.stringify(face.bbox || {}),
            metadata: JSON.stringify(face)
          });
        }
      }
      
      // Store behavior detections
      if (detections.behaviors && detections.behaviors.length > 0) {
        for (const behavior of detections.behaviors) {
          await db.insert(aiDetections).values({
            cameraId: analysis.camera_id,
            timestamp: new Date(analysis.timestamp),
            detectionType: 'behavior',
            confidence: behavior.confidence || 0,
            boundingBox: JSON.stringify({}),
            metadata: JSON.stringify(behavior)
          });
        }
      }
      
      console.log(`[AI] Stored ${detections.objects?.length || 0} objects, ${detections.faces?.length || 0} faces, ${detections.behaviors?.length || 0} behaviors`);
      
    } catch (error) {
      console.error('[AI] Failed to store detections:', error);
    }
  }

  /**
   * Create alerts and broadcast to clients
   */
  private async createAndBroadcastAlerts(cameraId: string, alertsData: any[], analysis: any): Promise<void> {
    try {
      for (const alertData of alertsData) {
        // Insert alert into database
        const [alertResult] = await db.insert(alerts).values({
          cameraId: cameraId,
          alertType: alertData.type || 'security',
          severity: alertData.severity || 'medium',
          message: alertData.message || 'Security alert detected',
          metadata: JSON.stringify(alertData),
          timestamp: new Date(analysis.timestamp),
          isResolved: false
        }).returning();
        
        // Broadcast alert to WebSocket clients
        this.wsManager.broadcastToCamera(cameraId, 'security_alert', {
          id: alertResult.id,
          camera_id: cameraId,
          type: alertData.type,
          severity: alertData.severity,
          message: alertData.message,
          timestamp: analysis.timestamp,
          detections: analysis.detections
        });
        
        console.log(`[AI] Created ${alertData.severity} alert: ${alertData.message}`);
      }
    } catch (error) {
      console.error('[AI] Failed to create alerts:', error);
    }
  }

  /**
   * Test AI service with mock data for development
   */
  async simulateAnalysis(cameraId: string): Promise<any> {
    console.log(`[AI] Simulating analysis for camera ${cameraId}`);
    
    // Create mock analysis result
    const mockResult = {
      camera_id: cameraId,
      timestamp: new Date().toISOString(),
      detections: {
        objects: [
          {
            class: 'person',
            confidence: 0.95,
            bbox: [100, 150, 200, 400],
            suspicious_activity: true
          }
        ],
        faces: [],
        behaviors: [
          {
            type: 'loitering',
            confidence: 0.75,
            duration: 120,
            location: [150, 275]
          }
        ],
        gait_profiles: []
      },
      threat_level: 'medium',
      alerts: [
        {
          type: 'suspicious_behavior',
          severity: 'medium',
          message: 'Suspicious loitering detected',
          confidence: 0.75
        }
      ],
      processing_time_ms: 250
    };
    
    // Process the mock result
    await this.processAIResult(cameraId, mockResult, []);
    
    return mockResult;
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<any> {
    try {
      const command = `python3 ${this.pythonBridgePath} health`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.warn(`[AI] Health check warning: ${stderr}`);
      }
      
      return JSON.parse(stdout.trim());
      
    } catch (error) {
      console.error('[AI] Health check failed:', error);
      return {
        status: 'error',
        error: error.message || 'Health check failed',
        timestamp: new Date().toISOString()
      };
    }
  }
}