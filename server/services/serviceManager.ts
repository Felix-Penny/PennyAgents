import winston from 'winston';
import awsRekognitionService from './awsRekognitionService';
import s3StorageService from './s3StorageService';
import openAIService from './openAIService';
import twilioSMSService from './twilioSMSService';
import emailService from './emailService';
import authController from './authController';
import onvifCameraService from './onvifCameraService';
import pennyAdminService from './pennyAdminService';
import hybridStorageService from './hybridStorageService';

export interface ServiceStatus {
  name: string;
  configured: boolean;
  operational: boolean;
  lastCheck: Date;
  error?: string;
  details?: any;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  services: ServiceStatus[];
  totalServices: number;
  healthyServices: number;
  criticalServices: string[];
  lastHealthCheck: Date;
}

class ServiceManager {
  private logger: winston.Logger;
  private services: Map<string, { service: any; critical: boolean }>;
  private healthCheckInterval: NodeJS.Timeout | null;
  private lastHealthCheck: SystemHealth | null;

  constructor() {
    this.services = new Map();
    this.healthCheckInterval = null;
    this.lastHealthCheck = null;

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/service-manager.log' })
      ]
    });

    this.registerServices();
    this.startHealthChecks();
  }

  private registerServices(): void {
    // Register all services with their criticality level
    this.services.set('aws-rekognition', { 
      service: awsRekognitionService, 
      critical: false 
    });
    
    this.services.set('s3-storage', { 
      service: s3StorageService, 
      critical: false 
    });
    
    this.services.set('openai', { 
      service: openAIService, 
      critical: false 
    });
    
    this.services.set('twilio-sms', { 
      service: twilioSMSService, 
      critical: false 
    });
    
    this.services.set('email', { 
      service: emailService, 
      critical: false 
    });
    
    this.services.set('authentication', { 
      service: authController, 
      critical: true 
    });
    
    this.services.set('onvif-camera', { 
      service: onvifCameraService, 
      critical: false 
    });
    
    this.services.set('penny-admin', { 
      service: pennyAdminService, 
      critical: false 
    });
    
    this.services.set('hybrid-storage', { 
      service: hybridStorageService, 
      critical: true 
    });

    this.logger.info(`Registered ${this.services.size} services`);
  }

  async checkServiceHealth(serviceName: string): Promise<ServiceStatus> {
    const serviceEntry = this.services.get(serviceName);
    
    if (!serviceEntry) {
      return {
        name: serviceName,
        configured: false,
        operational: false,
        lastCheck: new Date(),
        error: 'Service not found'
      };
    }

    const { service } = serviceEntry;

    try {
      const status: ServiceStatus = {
        name: serviceName,
        configured: false,
        operational: false,
        lastCheck: new Date()
      };

      // Check if service is configured
      if (typeof service.isConfigured === 'function') {
        status.configured = service.isConfigured();
      } else {
        status.configured = true; // Assume configured if no check method
      }

      // Test service connectivity/functionality
      let testResult = null;

      switch (serviceName) {
        case 'aws-rekognition':
          // Test with collection stats (lightweight operation)
          testResult = await service.getCollectionStats();
          status.operational = !!testResult;
          break;

        case 's3-storage':
          // Test storage mode check
          status.operational = service.getStorageMode() !== null;
          status.details = { storageMode: service.getStorageMode() };
          break;

        case 'openai':
          testResult = await service.testConnection();
          status.operational = testResult.success;
          if (!testResult.success) {
            status.error = testResult.error;
          }
          break;

        case 'twilio-sms':
          testResult = await service.testConnection();
          status.operational = testResult.success;
          if (!testResult.success) {
            status.error = testResult.error;
          }
          break;

        case 'email':
          // For email, we'll consider it operational if configured
          status.operational = status.configured;
          break;

        case 'authentication':
          // Authentication service is always operational if configured
          status.operational = status.configured;
          break;

        case 'onvif-camera':
          status.operational = status.configured;
          status.details = service.getConfiguration();
          break;

        case 'penny-admin':
          status.operational = status.configured;
          status.details = service.getConfiguration();
          break;

        case 'hybrid-storage':
          status.operational = true; // Always operational (has local fallback)
          status.details = service.getConfiguration();
          break;

        default:
          status.operational = status.configured;
      }

      return status;

    } catch (error) {
      this.logger.error(`Health check failed for ${serviceName}:`, error);
      return {
        name: serviceName,
        configured: false,
        operational: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  async checkSystemHealth(): Promise<SystemHealth> {
    const serviceStatuses: ServiceStatus[] = [];
    
    // Check all services
    for (const serviceName of Array.from(this.services.keys())) {
      const status = await this.checkServiceHealth(serviceName);
      serviceStatuses.push(status);
    }

    const totalServices = serviceStatuses.length;
    const healthyServices = serviceStatuses.filter(s => s.operational).length;
    const criticalServices = serviceStatuses
      .filter(s => !s.operational && this.services.get(s.name)?.critical)
      .map(s => s.name);

    let overall: 'healthy' | 'degraded' | 'critical';

    if (criticalServices.length > 0) {
      overall = 'critical';
    } else if (healthyServices < totalServices * 0.8) { // Less than 80% healthy
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const systemHealth: SystemHealth = {
      overall,
      services: serviceStatuses,
      totalServices,
      healthyServices,
      criticalServices,
      lastHealthCheck: new Date()
    };

    this.lastHealthCheck = systemHealth;

    this.logger.info('System health check completed', {
      overall,
      healthyServices,
      totalServices,
      criticalServices: criticalServices.length
    });

    return systemHealth;
  }

  async initializeAllServices(): Promise<{ success: boolean; initialized: string[]; failed: string[]; errors: Record<string, string> }> {
    const initialized: string[] = [];
    const failed: string[] = [];
    const errors: Record<string, string> = {};

    this.logger.info('Starting service initialization...');

    for (const [serviceName, { service }] of Array.from(this.services.entries())) {
      try {
        // Some services might have an initialize method
        if (typeof service.initialize === 'function') {
          await service.initialize();
        }

        // Check if service is properly configured
        const healthStatus = await this.checkServiceHealth(serviceName);
        
        if (healthStatus.configured) {
          initialized.push(serviceName);
          this.logger.info(`Service initialized: ${serviceName}`);
        } else {
          failed.push(serviceName);
          errors[serviceName] = healthStatus.error || 'Service not configured';
          this.logger.warn(`Service initialization failed: ${serviceName}`, { error: errors[serviceName] });
        }

      } catch (error) {
        failed.push(serviceName);
        errors[serviceName] = error instanceof Error ? error.message : 'Initialization failed';
        this.logger.error(`Service initialization error: ${serviceName}`, error);
      }
    }

    const success = failed.length === 0 || initialized.length > 0;

    this.logger.info('Service initialization completed', {
      success,
      initialized: initialized.length,
      failed: failed.length
    });

    return {
      success,
      initialized,
      failed,
      errors
    };
  }

  getLastHealthCheck(): SystemHealth | null {
    return this.lastHealthCheck;
  }

  async getServiceConfiguration(serviceName: string): Promise<any> {
    const serviceEntry = this.services.get(serviceName);
    
    if (!serviceEntry) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const { service } = serviceEntry;

    if (typeof service.getConfiguration === 'function') {
      return service.getConfiguration();
    }

    return {
      name: serviceName,
      configured: typeof service.isConfigured === 'function' ? service.isConfigured() : true
    };
  }

  async getAllServiceConfigurations(): Promise<Record<string, any>> {
    const configurations: Record<string, any> = {};

    for (const serviceName of Array.from(this.services.keys())) {
      try {
        configurations[serviceName] = await this.getServiceConfiguration(serviceName);
      } catch (error) {
        configurations[serviceName] = {
          error: error instanceof Error ? error.message : 'Failed to get configuration'
        };
      }
    }

    return configurations;
  }

  private startHealthChecks(): void {
    const intervalMs = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000');

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        this.logger.error('Automated health check failed:', error);
      }
    }, intervalMs);

    // Perform initial health check
    setImmediate(async () => {
      await this.checkSystemHealth();
    });

    this.logger.info(`Started health checks with ${intervalMs}ms interval`);
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown services that have shutdown methods
    for (const [serviceName, { service }] of Array.from(this.services.entries())) {
      try {
        if (typeof service.shutdown === 'function') {
          await service.shutdown();
          this.logger.info(`Service shutdown: ${serviceName}`);
        }
      } catch (error) {
        this.logger.error(`Service shutdown failed: ${serviceName}`, error);
      }
    }

    this.logger.info('Service manager shutdown completed');
  }

  // Service access methods
  get rekognition() { return awsRekognitionService; }
  get s3Storage() { return s3StorageService; }
  get openai() { return openAIService; }
  get twilioSMS() { return twilioSMSService; }
  get email() { return emailService; }
  get auth() { return authController; }
  get onvifCamera() { return onvifCameraService; }
  get pennyAdmin() { return pennyAdminService; }
  get hybridStorage() { return hybridStorageService; }

  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  isServiceCritical(serviceName: string): boolean {
    return this.services.get(serviceName)?.critical || false;
  }
}

export default new ServiceManager();