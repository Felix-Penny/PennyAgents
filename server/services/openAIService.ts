import OpenAI from 'openai';
import winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

interface ImageAnalysisResult {
  success: boolean;
  analysis?: {
    description: string;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    detectedObjects: string[];
    suspiciousActivity: boolean;
    recommendations: string[];
    reasoning: string;
  };
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface TextAnalysisResult {
  success: boolean;
  analysis?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    keyTopics: string[];
    summary: string;
    actionItems?: string[];
  };
  error?: string;
}

interface BehaviorAnalysisResult {
  success: boolean;
  analysis?: {
    behaviorType: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    timeline: Array<{
      timestamp: number;
      action: string;
      confidence: number;
    }>;
    patterns: string[];
    recommendations: string[];
  };
  error?: string;
}

class OpenAIService {
  private client: OpenAI;
  private logger: winston.Logger;
  private defaultModel: string;
  private fallbackModel: string;
  private maxTokens: number;
  private temperature: number;
  private imageDetail: 'low' | 'high';

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    this.defaultModel = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4-vision-preview';
    this.fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '4096');
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.1');
    this.imageDetail = (process.env.OPENAI_IMAGE_DETAIL as 'low' | 'high') || 'high';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/openai.log' })
      ]
    });
  }

  async analyzeSecurityImage(imageBuffer: Buffer, context?: string): Promise<ImageAnalysisResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      const prompt = this.buildSecurityAnalysisPrompt(context);

      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: this.imageDetail
                }
              }
            ]
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response content received from OpenAI');
      }

      const analysis = this.parseSecurityAnalysis(content);

      this.logger.info('Security image analysis completed', {
        model: this.defaultModel,
        threatLevel: analysis?.threatLevel || 'unknown',
        confidence: analysis?.confidence || 0
      });

      return {
        success: true,
        analysis,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      this.logger.error('OpenAI image analysis failed:', error);

      // Try fallback model if vision model fails
      if (this.defaultModel.includes('vision') && error instanceof Error && error.message.includes('model')) {
        this.logger.warn('Attempting fallback to text-only model');
        return await this.analyzeWithFallback(context);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async analyzeWithFallback(context?: string): Promise<ImageAnalysisResult> {
    try {
      const prompt = `Based on the security context provided, analyze the situation and provide a threat assessment. Context: ${context || 'No additional context provided'}`;

      const response = await this.client.chat.completions.create({
        model: this.fallbackModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response content received from fallback model');
      }

      const analysis = this.parseSecurityAnalysis(content);

      return {
        success: true,
        analysis,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      this.logger.error('Fallback analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async analyzeBehavior(behaviorData: any[]): Promise<BehaviorAnalysisResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const prompt = this.buildBehaviorAnalysisPrompt(behaviorData);

      const response = await this.client.chat.completions.create({
        model: this.fallbackModel, // Use text model for behavior analysis
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response content received from OpenAI');
      }

      const analysis = this.parseBehaviorAnalysis(content);

      this.logger.info('Behavior analysis completed', {
        behaviorType: analysis?.behaviorType || 'unknown',
        riskLevel: analysis?.riskLevel || 'unknown'
      });

      return {
        success: true,
        analysis
      };

    } catch (error) {
      this.logger.error('OpenAI behavior analysis failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async generateIncidentReport(incidentData: {
    timestamp: Date;
    location: string;
    description: string;
    evidence: string[];
    involvedPersons?: string[];
    severity: string;
  }): Promise<{ success: boolean; report?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const prompt = `
        Generate a professional incident report based on the following information:
        
        Timestamp: ${incidentData.timestamp.toISOString()}
        Location: ${incidentData.location}
        Description: ${incidentData.description}
        Evidence Files: ${incidentData.evidence.join(', ')}
        Involved Persons: ${incidentData.involvedPersons?.join(', ') || 'Unknown'}
        Severity: ${incidentData.severity}
        
        Please provide a comprehensive incident report that includes:
        1. Executive Summary
        2. Incident Details
        3. Timeline of Events
        4. Evidence Summary
        5. Recommendations
        6. Next Steps
        
        Format the report professionally and objectively.
      `;

      const response = await this.client.chat.completions.create({
        model: this.fallbackModel,
        messages: [
          {
            role: 'system',
            content: 'You are a professional security analyst writing incident reports. Be objective, clear, and thorough.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.3 // Lower temperature for more consistent reports
      });

      const report = response.choices[0]?.message?.content;
      
      if (!report) {
        throw new Error('No report generated');
      }

      this.logger.info('Incident report generated');

      return {
        success: true,
        report
      };

    } catch (error) {
      this.logger.error('Incident report generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async summarizeAlerts(alerts: any[]): Promise<{ success: boolean; summary?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const alertSummary = alerts.map(alert => 
        `${alert.timestamp}: ${alert.type} - ${alert.description} (Severity: ${alert.severity})`
      ).join('\n');

      const prompt = `
        Analyze the following security alerts and provide a concise summary:
        
        ${alertSummary}
        
        Please provide:
        1. Overall threat assessment
        2. Most critical alerts
        3. Patterns or trends
        4. Recommended actions
        5. Priority level for response
        
        Keep the summary concise but comprehensive.
      `;

      const response = await this.client.chat.completions.create({
        model: this.fallbackModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: this.temperature
      });

      const summary = response.choices[0]?.message?.content;
      
      if (!summary) {
        throw new Error('No summary generated');
      }

      return {
        success: true,
        summary
      };

    } catch (error) {
      this.logger.error('Alert summarization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private buildSecurityAnalysisPrompt(context?: string): string {
    return `
      You are an expert security analyst. Analyze this security camera image and provide a detailed assessment.
      
      ${context ? `Additional context: ${context}` : ''}
      
      Please provide your analysis in the following JSON format:
      {
        "description": "Detailed description of what you see in the image",
        "threatLevel": "low|medium|high|critical",
        "confidence": 0.85,
        "detectedObjects": ["person", "bag", "weapon", etc.],
        "suspiciousActivity": true/false,
        "recommendations": ["Immediate actions to take"],
        "reasoning": "Detailed explanation of your assessment"
      }
      
      Consider factors such as:
      - Unusual behavior or positioning
      - Suspicious objects or items
      - Time of day and location context
      - Person's demeanor and actions
      - Environmental factors
      
      Be thorough but concise in your analysis.
    `;
  }

  private buildBehaviorAnalysisPrompt(behaviorData: any[]): string {
    const dataString = JSON.stringify(behaviorData, null, 2);
    
    return `
      Analyze the following behavior tracking data and identify patterns or anomalies:
      
      ${dataString}
      
      Please provide your analysis in the following JSON format:
      {
        "behaviorType": "Description of the behavior pattern",
        "riskLevel": "low|medium|high|critical",
        "confidence": 0.85,
        "timeline": [{"timestamp": 123456789, "action": "description", "confidence": 0.9}],
        "patterns": ["Pattern descriptions"],
        "recommendations": ["Actions to take"]
      }
      
      Focus on identifying unusual patterns, potential security risks, and actionable insights.
    `;
  }

  private parseSecurityAnalysis(content: string): ImageAnalysisResult['analysis'] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          description: parsed.description || 'No description provided',
          threatLevel: parsed.threatLevel || 'low',
          confidence: parsed.confidence || 0.5,
          detectedObjects: parsed.detectedObjects || [],
          suspiciousActivity: parsed.suspiciousActivity || false,
          recommendations: parsed.recommendations || [],
          reasoning: parsed.reasoning || 'No reasoning provided'
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse structured response, using fallback parsing');
    }

    // Fallback to text parsing
    return {
      description: content,
      threatLevel: content.toLowerCase().includes('high') || content.toLowerCase().includes('critical') ? 'high' : 'low',
      confidence: 0.7,
      detectedObjects: this.extractDetectedObjects(content),
      suspiciousActivity: content.toLowerCase().includes('suspicious') || content.toLowerCase().includes('threat'),
      recommendations: ['Manual review recommended'],
      reasoning: 'Analysis based on text content parsing'
    };
  }

  private parseBehaviorAnalysis(content: string): BehaviorAnalysisResult['analysis'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          behaviorType: parsed.behaviorType || 'Unknown behavior',
          riskLevel: parsed.riskLevel || 'low',
          confidence: parsed.confidence || 0.5,
          timeline: parsed.timeline || [],
          patterns: parsed.patterns || [],
          recommendations: parsed.recommendations || []
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse behavior analysis response');
    }

    return {
      behaviorType: 'General behavior analysis',
      riskLevel: 'low',
      confidence: 0.5,
      timeline: [],
      patterns: [content],
      recommendations: ['Manual review recommended']
    };
  }

  private extractDetectedObjects(content: string): string[] {
    const objects: string[] = [];
    const commonObjects = ['person', 'people', 'individual', 'bag', 'backpack', 'weapon', 'knife', 'gun', 'vehicle', 'car', 'door', 'window'];
    
    for (const obj of commonObjects) {
      if (content.toLowerCase().includes(obj)) {
        objects.push(obj);
      }
    }

    return Array.from(new Set(objects)); // Remove duplicates
  }

  async testConnection(): Promise<{ success: boolean; model?: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OpenAI API key not configured'
      };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a connection test. Please respond with "Connection successful".'
          }
        ],
        max_tokens: 10
      });

      if (response.choices[0]?.message?.content) {
        return {
          success: true,
          model: 'gpt-3.5-turbo'
        };
      }

      return {
        success: false,
        error: 'No response received'
      };

    } catch (error) {
      this.logger.error('OpenAI connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  isConfigured(): boolean {
    return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-'));
  }

  getConfiguration(): {
    model: string;
    fallbackModel: string;
    maxTokens: number;
    temperature: number;
    imageDetail: string;
    configured: boolean;
  } {
    return {
      model: this.defaultModel,
      fallbackModel: this.fallbackModel,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      imageDetail: this.imageDetail,
      configured: this.isConfigured()
    };
  }
}

export default new OpenAIService();