/**
 * Security-Specific Threat Detection Service
 * Specialized AI analysis for retail security threats using OpenAI Vision API
 */

import OpenAI from "openai";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { aiVideoAnalyticsService, type AIDetectionResult, type FrameAnalysisResult, AI_MODELS } from "./videoAnalytics";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
});

// Threat categories and classifications
export const THREAT_CATEGORIES = {
  THEFT: 'theft',
  VIOLENCE: 'violence', 
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  WEAPONS: 'weapons',
  SUSPICIOUS_BEHAVIOR: 'suspicious_behavior',
  SAFETY_VIOLATION: 'safety_violation',
  VANDALISM: 'vandalism',
  TRESPASSING: 'trespassing'
} as const;

export const THREAT_SUBCATEGORIES = {
  // Theft subcategories
  SHOPLIFTING: 'shoplifting',
  ROBBERY: 'robbery',
  EMPLOYEE_THEFT: 'employee_theft',
  ORGANIZED_RETAIL_CRIME: 'organized_retail_crime',
  
  // Violence subcategories
  ASSAULT: 'assault',
  FIGHTING: 'fighting',
  DOMESTIC_VIOLENCE: 'domestic_violence',
  THREAT_GESTURES: 'threat_gestures',
  
  // Weapon subcategories
  KNIFE: 'knife',
  GUN: 'gun',
  IMPROVISED_WEAPON: 'improvised_weapon',
  CONCEALED_WEAPON: 'concealed_weapon',
  
  // Behavior subcategories
  LOITERING: 'loitering',
  SURVEILLANCE: 'surveillance',
  SUSPICIOUS_PACKAGE: 'suspicious_package',
  ERRATIC_BEHAVIOR: 'erratic_behavior'
} as const;

export const SEVERITY_LEVELS = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency'
} as const;

export interface ThreatDetection {
  id: string;
  category: keyof typeof THREAT_CATEGORIES;
  subcategory?: keyof typeof THREAT_SUBCATEGORIES;
  severity: keyof typeof SEVERITY_LEVELS;
  confidence: number; // 0-1
  riskScore: number; // 1-10
  priorityLevel: 'low' | 'normal' | 'high' | 'urgent' | 'immediate';
  
  // Detection details
  description: string;
  reasoning: string;
  evidenceDescription: string;
  
  // Location and timing
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timestamp: number;
  
  // Response requirements
  immediateResponse: boolean;
  lawEnforcementRequired: boolean;
  emergencyServicesRequired: boolean;
  storeEvacuationRequired: boolean;
  
  // Additional context
  environmentalFactors?: {
    lighting: 'poor' | 'fair' | 'good' | 'excellent';
    crowdLevel: 'empty' | 'sparse' | 'moderate' | 'dense';
    timeOfDay: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
  };
  
  associatedObjects?: string[];
  involvedPersons?: number;
  weaponsDetected?: string[];
}

export interface ThreatAnalysisConfig {
  focusCategories?: (keyof typeof THREAT_CATEGORIES)[];
  minimumConfidence?: number; // 0-1
  minimumRiskScore?: number; // 1-10
  enableRealTimeAlerts?: boolean;
  customThreatPrompts?: Record<string, string>;
  contextualFactors?: {
    storeType?: 'grocery' | 'electronics' | 'pharmacy' | 'clothing' | 'general';
    operatingHours?: { open: string; close: string };
    highRiskAreas?: string[];
    currentEvents?: string[];
  };
}

export interface ComprehensiveThreatAssessment {
  assessmentId: string;
  storeId: string;
  cameraId: string;
  timestamp: Date;
  
  detectedThreats: ThreatDetection[];
  overallRiskLevel: keyof typeof SEVERITY_LEVELS;
  recommendedActions: string[];
  
  analysisMetrics: {
    totalThreats: number;
    highSeverityThreats: number;
    averageConfidence: number;
    averageRiskScore: number;
    processingTime: number;
  };
  
  contextualAnalysis: {
    sceneDescription: string;
    crowdDynamics: string;
    environmentalRisks: string[];
    temporalFactors: string[];
  };
}

export class ThreatDetectionService {
  private threatClassifications = new Map<string, any>(); // Cache for threat classifications
  
  constructor() {
    this.loadThreatClassifications();
  }

  /**
   * Load threat classifications from database for enhanced analysis
   */
  private async loadThreatClassifications(): Promise<void> {
    try {
      const classifications = await storage.getThreatClassificationsByStore('default') || [];
      for (const classification of classifications) {
        this.threatClassifications.set(classification.id, classification);
      }
      console.log(`Loaded ${classifications.length} threat classifications`);
    } catch (error) {
      console.warn('Failed to load threat classifications:', error);
    }
  }

  /**
   * Analyze frame specifically for security threats with specialized prompts
   */
  async analyzeThreatFrame(
    imageBuffer: Buffer,
    storeId: string,
    cameraId: string,
    config: ThreatAnalysisConfig = {}
  ): Promise<ComprehensiveThreatAssessment> {
    const assessmentId = randomUUID();
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Build specialized threat detection prompt
      const threatPrompt = this.buildThreatDetectionPrompt(config);

      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');

      const response = await openai.chat.completions.create({
        model: AI_MODELS.GPT_4O,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: threatPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });

      // Robust JSON parsing with error handling
      let analysis: any = {};
      const responseContent = response.choices[0]?.message?.content;
      
      if (responseContent) {
        try {
          analysis = JSON.parse(responseContent);
        } catch (parseError) {
          console.warn('Threat detection JSON parsing failed:', parseError);
          console.warn('Raw response content:', responseContent);
          
          // Attempt to extract JSON from partial response
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              analysis = JSON.parse(jsonMatch[0]);
            } catch (secondParseError) {
              console.error('Failed to parse extracted JSON:', secondParseError);
              analysis = this.getDefaultThreatAnalysis();
            }
          } else {
            analysis = this.getDefaultThreatAnalysis();
          }
        }
      } else {
        console.warn('Empty response content for threat detection');
        analysis = this.getDefaultThreatAnalysis();
      }

      const processingTime = Date.now() - startTime;

      // Parse threats from AI response
      const detectedThreats = this.parseThreats(analysis, timestamp.getTime());

      // Calculate overall risk assessment
      const overallRiskLevel = this.calculateOverallRisk(detectedThreats);
      const recommendedActions = this.generateRecommendedActions(detectedThreats, analysis);

      const assessment: ComprehensiveThreatAssessment = {
        assessmentId,
        storeId,
        cameraId,
        timestamp,
        detectedThreats,
        overallRiskLevel,
        recommendedActions,
        analysisMetrics: {
          totalThreats: detectedThreats.length,
          highSeverityThreats: detectedThreats.filter(t => 
            t.severity === 'HIGH' || t.severity === 'CRITICAL' || t.severity === 'EMERGENCY'
          ).length,
          averageConfidence: detectedThreats.length > 0 
            ? detectedThreats.reduce((sum, t) => sum + t.confidence, 0) / detectedThreats.length 
            : 0,
          averageRiskScore: detectedThreats.length > 0
            ? detectedThreats.reduce((sum, t) => sum + t.riskScore, 0) / detectedThreats.length
            : 0,
          processingTime
        },
        contextualAnalysis: {
          sceneDescription: analysis.sceneDescription || 'No description available',
          crowdDynamics: analysis.crowdDynamics || 'No crowd analysis available',
          environmentalRisks: analysis.environmentalRisks || [],
          temporalFactors: analysis.temporalFactors || []
        }
      };

      // Store threat assessment and create alerts if necessary
      await this.processThreatAssessment(assessment);

      return assessment;

    } catch (error) {
      console.error('Threat analysis failed:', error);
      throw new Error(`Threat analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build specialized threat detection prompt
   */
  private buildThreatDetectionPrompt(config: ThreatAnalysisConfig): string {
    const focusCategories = config.focusCategories || Object.values(THREAT_CATEGORIES);
    const minConfidence = config.minimumConfidence || 0.7;
    const contextualInfo = config.contextualFactors ? this.buildContextualInfo(config.contextualFactors) : '';

    return `
You are an expert security threat detection AI analyzing retail security camera footage. Your primary mission is to identify and assess threats to store security, personnel, and customers.

CRITICAL THREAT CATEGORIES TO DETECT:
${focusCategories.map(category => `
- **${category.toUpperCase()}**: ${this.getThreatCategoryDescription(category)}
`).join('')}

ANALYSIS REQUIREMENTS:
1. **THREAT IDENTIFICATION**: Detect and classify all potential security threats
2. **RISK ASSESSMENT**: Evaluate severity and immediate danger level
3. **EVIDENCE ANALYSIS**: Describe visible evidence supporting threat classification
4. **CONTEXTUAL UNDERSTANDING**: Consider environmental and situational factors
5. **ACTIONABLE INTELLIGENCE**: Provide clear, actionable threat information

SECURITY FOCUS AREAS:
- **Theft Prevention**: Shoplifting, concealment, suspicious bag/container usage
- **Violence Detection**: Aggressive behavior, physical altercations, threatening gestures
- **Weapon Identification**: Knives, guns, improvised weapons, concealed weapons
- **Access Control**: Unauthorized area access, after-hours presence, restricted zones
- **Suspicious Behavior**: Loitering, surveillance, case-building, coordinated activity
- **Emergency Situations**: Medical emergencies, safety hazards, crowd control issues

${contextualInfo}

RESPONSE FORMAT - Provide EXACT JSON structure:
{
  "threats": [
    {
      "id": "threat_1",
      "category": "${focusCategories[0]}",
      "subcategory": "specific_threat_type",
      "severity": "low|medium|high|critical|emergency",
      "confidence": 0.85,
      "riskScore": 7,
      "priorityLevel": "low|normal|high|urgent|immediate",
      "description": "Clear, specific description of the threat",
      "reasoning": "Detailed explanation of why this is classified as a threat",
      "evidenceDescription": "Visible evidence supporting this threat assessment",
      "boundingBox": {"x": 100, "y": 50, "width": 200, "height": 300},
      "immediateResponse": true,
      "lawEnforcementRequired": false,
      "emergencyServicesRequired": false,
      "storeEvacuationRequired": false,
      "environmentalFactors": {
        "lighting": "good",
        "crowdLevel": "moderate",
        "timeOfDay": "afternoon"
      },
      "associatedObjects": ["bag", "container"],
      "involvedPersons": 1,
      "weaponsDetected": []
    }
  ],
  "overallRiskAssessment": "low|medium|high|critical|emergency",
  "sceneDescription": "Comprehensive description of the overall scene",
  "crowdDynamics": "Analysis of crowd behavior and movement patterns",
  "environmentalRisks": ["poor lighting", "blind spots"],
  "temporalFactors": ["after hours", "peak shopping time"],
  "recommendedActions": [
    "Immediate action 1",
    "Follow-up action 2"
  ],
  "confidenceLevel": 0.85,
  "analysisComplete": true
}

CRITICAL GUIDELINES:
- Only flag actual threats with confidence >= ${minConfidence}
- Provide specific, actionable descriptions
- Consider false positive implications
- Focus on immediate security concerns
- Prioritize customer and staff safety
- Account for normal retail behavior vs. suspicious activity

Be thorough but precise. Err on the side of caution for high-severity threats.
`;
  }

  /**
   * Parse threat detections from AI response
   */
  private parseThreats(analysis: any, timestamp: number): ThreatDetection[] {
    const threats: ThreatDetection[] = [];

    if (!analysis.threats || !Array.isArray(analysis.threats)) {
      return threats;
    }

    for (const threat of analysis.threats) {
      const detection: ThreatDetection = {
        id: threat.id || randomUUID(),
        category: threat.category || 'suspicious_behavior',
        subcategory: threat.subcategory,
        severity: threat.severity || 'low',
        confidence: Math.min(Math.max(threat.confidence || 0.5, 0), 1),
        riskScore: Math.min(Math.max(threat.riskScore || 1, 1), 10),
        priorityLevel: threat.priorityLevel || 'normal',
        description: threat.description || 'No description provided',
        reasoning: threat.reasoning || 'No reasoning provided',
        evidenceDescription: threat.evidenceDescription || 'No evidence description',
        boundingBox: threat.boundingBox,
        timestamp,
        immediateResponse: threat.immediateResponse || false,
        lawEnforcementRequired: threat.lawEnforcementRequired || false,
        emergencyServicesRequired: threat.emergencyServicesRequired || false,
        storeEvacuationRequired: threat.storeEvacuationRequired || false,
        environmentalFactors: threat.environmentalFactors,
        associatedObjects: threat.associatedObjects || [],
        involvedPersons: threat.involvedPersons || 1,
        weaponsDetected: threat.weaponsDetected || []
      };

      threats.push(detection);
    }

    return threats;
  }

  /**
   * Calculate overall risk level from detected threats
   */
  private calculateOverallRisk(threats: ThreatDetection[]): keyof typeof SEVERITY_LEVELS {
    if (threats.length === 0) return 'INFO';

    const severityScores = {
      'INFO': 0,
      'LOW': 1,
      'MEDIUM': 2, 
      'HIGH': 3,
      'CRITICAL': 4,
      'EMERGENCY': 5
    };

    let maxSeverity = 0;
    let avgRiskScore = 0;

    for (const threat of threats) {
      const severityScore = severityScores[threat.severity] || 0;
      maxSeverity = Math.max(maxSeverity, severityScore);
      avgRiskScore += threat.riskScore;
    }

    avgRiskScore /= threats.length;

    // Determine overall risk based on highest severity and average risk score
    if (maxSeverity >= 5 || avgRiskScore >= 9) return 'EMERGENCY';
    if (maxSeverity >= 4 || avgRiskScore >= 8) return 'CRITICAL';
    if (maxSeverity >= 3 || avgRiskScore >= 6) return 'HIGH';
    if (maxSeverity >= 2 || avgRiskScore >= 4) return 'MEDIUM';
    if (maxSeverity >= 1 || avgRiskScore >= 2) return 'LOW';
    
    return 'INFO';
  }

  /**
   * Generate recommended actions based on threats
   */
  private generateRecommendedActions(threats: ThreatDetection[], analysis: any): string[] {
    const actions: string[] = [];

    for (const threat of threats) {
      if (threat.immediateResponse) {
        actions.push(`IMMEDIATE: Respond to ${threat.category} threat - ${threat.description}`);
      }
      
      if (threat.lawEnforcementRequired) {
        actions.push(`Contact law enforcement regarding ${threat.category} incident`);
      }
      
      if (threat.emergencyServicesRequired) {
        actions.push(`Call emergency services for ${threat.category} situation`);
      }
      
      if (threat.storeEvacuationRequired) {
        actions.push(`EVACUATE STORE: ${threat.category} requires immediate evacuation`);
      }

      if (threat.weaponsDetected && threat.weaponsDetected.length > 0) {
        actions.push(`Weapon detected: ${threat.weaponsDetected.join(', ')} - Exercise extreme caution`);
      }
    }

    // Add general recommendations from analysis
    if (analysis.recommendedActions && Array.isArray(analysis.recommendedActions)) {
      actions.push(...analysis.recommendedActions);
    }

    return Array.from(new Set(actions)); // Remove duplicates
  }

  /**
   * Process threat assessment and create alerts/notifications
   */
  private async processThreatAssessment(assessment: ComprehensiveThreatAssessment): Promise<void> {
    try {
      // Create alerts for high-priority threats
      for (const threat of assessment.detectedThreats) {
        if (threat.severity === 'HIGH' || threat.severity === 'CRITICAL' || threat.severity === 'EMERGENCY') {
          await this.createThreatAlert(threat, assessment);
        }
        
        // Store individual threat detection
        await this.storeThreatDetection(threat, assessment);
      }

      // Store overall assessment
      await this.storeThreatAssessment(assessment);

      console.log(`Processed threat assessment ${assessment.assessmentId} with ${assessment.detectedThreats.length} threats`);

    } catch (error) {
      console.error('Failed to process threat assessment:', error);
    }
  }

  /**
   * Create alert for detected threat
   */
  private async createThreatAlert(threat: ThreatDetection, assessment: ComprehensiveThreatAssessment): Promise<void> {
    try {
      const alertTitle = `${threat.severity.toUpperCase()} THREAT: ${threat.category.replace('_', ' ').toUpperCase()}`;
      const alertMessage = `${threat.description}\n\nEvidence: ${threat.evidenceDescription}\n\nRisk Score: ${threat.riskScore}/10\nConfidence: ${Math.round(threat.confidence * 100)}%`;

      await storage.createAlert({
        storeId: assessment.storeId,
        cameraId: assessment.cameraId,
        type: threat.category as any,
        severity: threat.severity === 'EMERGENCY' ? 'CRITICAL' : threat.severity as any,
        title: alertTitle,
        message: alertMessage,
        isRead: false,
        isActive: true,
        metadata: {
          assessmentId: assessment.assessmentId,
          riskScore: threat.riskScore,
          confidence: threat.confidence,
          recommendedActions: assessment.recommendedActions,
          weaponsDetected: threat.weaponsDetected,
          immediateResponse: threat.immediateResponse,
          lawEnforcementRequired: threat.lawEnforcementRequired
        }
      });

    } catch (error) {
      console.error('Failed to create threat alert:', error);
    }
  }

  /**
   * Store threat detection in database
   */
  private async storeThreatDetection(threat: ThreatDetection, assessment: ComprehensiveThreatAssessment): Promise<void> {
    try {
      await storage.createAiDetection({
        storeId: assessment.storeId,
        cameraId: assessment.cameraId,
        detectionType: 'threat',
        threatType: threat.category as any,
        behaviorType: threat.subcategory as any,
        confidence: threat.confidence,
        boundingBox: threat.boundingBox,
        modelName: AI_MODELS.GPT_4O,
        modelVersion: '1.0',
        processingTime: assessment.analysisMetrics.processingTime,
        frameTimestamp: new Date(threat.timestamp),
        metadata: {
          riskScore: threat.riskScore,
          priorityLevel: threat.priorityLevel,
          description: threat.description,
          reasoning: threat.reasoning,
          evidenceDescription: threat.evidenceDescription,
          immediateResponse: threat.immediateResponse,
          lawEnforcementRequired: threat.lawEnforcementRequired,
          emergencyServicesRequired: threat.emergencyServicesRequired,
          weaponsDetected: threat.weaponsDetected,
          associatedObjects: threat.associatedObjects,
          environmentalFactors: threat.environmentalFactors
        }
      });

    } catch (error) {
      console.error('Failed to store threat detection:', error);
    }
  }

  /**
   * Store threat assessment in database
   */
  private async storeThreatAssessment(assessment: ComprehensiveThreatAssessment): Promise<void> {
    // Implementation would store in video_analytics table or create new threat_assessments table
    // For now, we'll use the video_analytics table
    try {
      await storage.createVideoAnalysis({
        storeId: assessment.storeId,
        cameraId: assessment.cameraId,
        videoFilePath: `threat_analysis_${assessment.assessmentId}`,
        analysisStatus: 'completed',
        detectedFaces: [],
        matchedOffenders: [],
        confidenceScores: { average: assessment.analysisMetrics.averageConfidence },
        modelsUsed: [{
          name: AI_MODELS.GPT_4O,
          version: '1.0',
          purpose: 'threat_detection'
        }],
        processingTime: assessment.analysisMetrics.processingTime,
        analyticsResults: {
          overallRiskLevel: assessment.overallRiskLevel,
          averageConfidence: assessment.analysisMetrics.averageConfidence,
          averageRiskScore: assessment.analysisMetrics.averageRiskScore,
          recommendedActions: assessment.recommendedActions,
          contextualAnalysis: assessment.contextualAnalysis
        }
      });

    } catch (error) {
      console.error('Failed to store threat assessment:', error);
    }
  }

  /**
   * Get threat category description for prompts
   */
  private getThreatCategoryDescription(category: string): string {
    const descriptions = {
      theft: 'Shoplifting, concealment, organized retail crime, employee theft',
      violence: 'Physical altercations, assault, threatening behavior, domestic violence',
      unauthorized_access: 'Restricted area breach, after-hours presence, trespassing',
      weapons: 'Knives, guns, improvised weapons, concealed weapons',
      suspicious_behavior: 'Loitering, surveillance, case-building, erratic behavior',
      safety_violation: 'Safety hazards, emergency situations, crowd control issues',
      vandalism: 'Property damage, graffiti, destruction of merchandise',
      trespassing: 'Unauthorized presence, banned individuals, restricted access'
    };
    
    return descriptions[category as keyof typeof descriptions] || 'Security threat requiring assessment';
  }

  /**
   * Build contextual information for enhanced analysis
   */
  private buildContextualInfo(factors: NonNullable<ThreatAnalysisConfig['contextualFactors']>): string {
    let context = '\nCONTEXTUAL FACTORS:\n';
    
    if (factors.storeType) {
      context += `- Store Type: ${factors.storeType} (adjust threat assessment accordingly)\n`;
    }
    
    if (factors.operatingHours) {
      context += `- Operating Hours: ${factors.operatingHours.open} - ${factors.operatingHours.close}\n`;
    }
    
    if (factors.highRiskAreas && factors.highRiskAreas.length > 0) {
      context += `- High-Risk Areas: ${factors.highRiskAreas.join(', ')}\n`;
    }
    
    if (factors.currentEvents && factors.currentEvents.length > 0) {
      context += `- Current Events/Alerts: ${factors.currentEvents.join(', ')}\n`;
    }
    
    return context;
  }

  /**
   * Verify threat detection (for manual review/feedback)
   */
  async verifyThreatDetection(
    detectionId: string,
    isValid: boolean,
    feedback: string,
    verifiedBy: string
  ): Promise<void> {
    try {
      await storage.updateAiDetection(detectionId, {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
        isFalsePositive: !isValid,
        notes: feedback
      });

      console.log(`Threat detection ${detectionId} verified as ${isValid ? 'valid' : 'false positive'}`);

    } catch (error) {
      console.error('Failed to verify threat detection:', error);
      throw error;
    }
  }

  /**
   * Get default threat analysis structure for error cases
   */
  private getDefaultThreatAnalysis(): any {
    return {
      detectedThreats: [],
      overallRiskLevel: 'low',
      sceneDescription: 'Analysis failed - using default values',
      crowdDynamics: 'Unknown',
      environmentalRisks: [],
      temporalFactors: [],
      totalThreats: 0,
      highSeverityThreats: 0,
      averageConfidence: 0,
      averageRiskScore: 0
    };
  }
}

export const threatDetectionService = new ThreatDetectionService();