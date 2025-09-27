import twilio from 'twilio';
import winston from 'winston';

interface SMSResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  cost?: string;
  to?: string;
}

interface SMSMessage {
  to: string;
  body: string;
  mediaUrl?: string[];
  scheduledAt?: Date;
  priority?: 'low' | 'normal' | 'high';
  category?: 'alert' | 'notification' | 'report' | 'test';
}

interface BulkSMSResult {
  success: boolean;
  results: SMSResult[];
  totalSent: number;
  totalFailed: number;
  errors: string[];
}

interface SMSStatus {
  messageId: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  dateCreated: Date;
  dateSent?: Date;
  dateUpdated: Date;
  price?: string;
  priceUnit?: string;
}

class TwilioSMSService {
  private client: twilio.Twilio;
  private fromNumber: string;
  private webhookUrl: string;
  private statusCallbackUrl: string;
  private logger: winston.Logger;
  private rateLimiter: Map<string, { count: number; resetTime: number }>;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    
    this.client = twilio(accountSid, authToken);
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.webhookUrl = process.env.TWILIO_WEBHOOK_URL || '';
    this.statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK || '';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/twilio.log' })
      ]
    });

    // Rate limiter to prevent spam (per phone number)
    this.rateLimiter = new Map();
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Twilio not configured properly'
      };
    }

    // Check rate limiting
    if (!this.checkRateLimit(message.to)) {
      return {
        success: false,
        error: 'Rate limit exceeded for this phone number'
      };
    }

    try {
      const messageOptions: any = {
        to: message.to,
        from: this.fromNumber,
        body: message.body
      };

      // Add media URLs if provided
      if (message.mediaUrl && message.mediaUrl.length > 0) {
        messageOptions.mediaUrl = message.mediaUrl;
      }

      // Add status callback if configured
      if (this.statusCallbackUrl) {
        messageOptions.statusCallback = this.statusCallbackUrl;
      }

      // Send scheduled message if specified
      if (message.scheduledAt) {
        messageOptions.sendAt = message.scheduledAt;
      }

      const response = await this.client.messages.create(messageOptions);

      this.logger.info('SMS sent successfully', {
        messageId: response.sid,
        to: message.to,
        status: response.status,
        category: message.category || 'unknown'
      });

      return {
        success: true,
        messageId: response.sid,
        status: response.status,
        to: message.to,
        cost: response.price || undefined
      };

    } catch (error) {
      this.logger.error('SMS sending failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: message.to,
        category: message.category
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        to: message.to
      };
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<BulkSMSResult> {
    const results: SMSResult[] = [];
    const errors: string[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    this.logger.info(`Starting bulk SMS send for ${messages.length} messages`);

    // Send messages with rate limiting
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      try {
        const result = await this.sendSMS(message);
        results.push(result);

        if (result.success) {
          totalSent++;
        } else {
          totalFailed++;
          if (result.error) {
            errors.push(`${message.to}: ${result.error}`);
          }
        }

        // Add delay between messages to respect rate limits
        if (i < messages.length - 1) {
          await this.delay(100); // 100ms delay between messages
        }

      } catch (error) {
        totalFailed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${message.to}: ${errorMsg}`);
        
        results.push({
          success: false,
          error: errorMsg,
          to: message.to
        });
      }
    }

    this.logger.info('Bulk SMS send completed', {
      total: messages.length,
      sent: totalSent,
      failed: totalFailed
    });

    return {
      success: totalSent > 0,
      results,
      totalSent,
      totalFailed,
      errors
    };
  }

  async sendSecurityAlert(phoneNumber: string, alertData: {
    type: string;
    location: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    evidenceUrl?: string;
  }): Promise<SMSResult> {
    const body = this.formatSecurityAlert(alertData);
    
    const mediaUrl = alertData.evidenceUrl ? [alertData.evidenceUrl] : undefined;

    return await this.sendSMS({
      to: phoneNumber,
      body,
      mediaUrl,
      priority: alertData.severity === 'critical' ? 'high' : 'normal',
      category: 'alert'
    });
  }

  async sendWeeklyReport(phoneNumber: string, reportData: {
    weekStart: Date;
    weekEnd: Date;
    totalAlerts: number;
    criticalAlerts: number;
    storeLocation: string;
    reportUrl?: string;
  }): Promise<SMSResult> {
    const body = this.formatWeeklyReport(reportData);

    const mediaUrl = reportData.reportUrl ? [reportData.reportUrl] : undefined;

    return await this.sendSMS({
      to: phoneNumber,
      body,
      mediaUrl,
      priority: 'low',
      category: 'report'
    });
  }

  async getMessageStatus(messageId: string): Promise<SMSStatus | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const message = await this.client.messages(messageId).fetch();

      return {
        messageId: message.sid,
        status: message.status,
        errorCode: message.errorCode?.toString() || undefined,
        errorMessage: message.errorMessage || undefined,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent || undefined,
        dateUpdated: message.dateUpdated,
        price: message.price || undefined,
        priceUnit: message.priceUnit || undefined
      };

    } catch (error) {
      this.logger.error('Failed to fetch message status:', error);
      return null;
    }
  }

  async validatePhoneNumber(phoneNumber: string): Promise<{
    valid: boolean;
    formatted?: string;
    carrier?: string;
    type?: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        valid: false,
        error: 'Twilio not configured'
      };
    }

    try {
      const lookup = await this.client.lookups.v1.phoneNumbers(phoneNumber).fetch({
        type: ['carrier']
      });

      return {
        valid: true,
        formatted: lookup.phoneNumber,
        carrier: lookup.carrier?.name,
        type: lookup.carrier?.type
      };

    } catch (error) {
      this.logger.warn('Phone number validation failed:', {
        phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async handleWebhook(body: any): Promise<{
    success: boolean;
    messageId?: string;
    status?: string;
    error?: string;
  }> {
    try {
      const messageId = body.MessageSid || body.SmsSid;
      const status = body.MessageStatus || body.SmsStatus;
      const errorCode = body.ErrorCode;
      const errorMessage = body.ErrorMessage;

      if (!messageId) {
        throw new Error('No message ID in webhook payload');
      }

      this.logger.info('Received Twilio webhook', {
        messageId,
        status,
        errorCode,
        errorMessage
      });

      // Here you could update your database with the message status
      // await this.updateMessageStatus(messageId, status, errorCode, errorMessage);

      return {
        success: true,
        messageId,
        status
      };

    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string; accountInfo?: any }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Twilio credentials not configured'
      };
    }

    try {
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
      
      return {
        success: true,
        accountInfo: {
          friendlyName: account.friendlyName,
          status: account.status,
          type: account.type
        }
      };

    } catch (error) {
      this.logger.error('Twilio connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private formatSecurityAlert(alertData: {
    type: string;
    location: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }): string {
    const severityEmoji = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨'
    };

    const time = alertData.timestamp.toLocaleString();

    return `${severityEmoji[alertData.severity]} SECURITY ALERT

Type: ${alertData.type}
Location: ${alertData.location}
Time: ${time}
Severity: ${alertData.severity.toUpperCase()}

${alertData.description}

Please review immediately. Reply STOP to unsubscribe.`;
  }

  private formatWeeklyReport(reportData: {
    weekStart: Date;
    weekEnd: Date;
    totalAlerts: number;
    criticalAlerts: number;
    storeLocation: string;
  }): string {
    const startDate = reportData.weekStart.toLocaleDateString();
    const endDate = reportData.weekEnd.toLocaleDateString();

    return `📊 WEEKLY SECURITY REPORT

Store: ${reportData.storeLocation}
Period: ${startDate} - ${endDate}

Total Alerts: ${reportData.totalAlerts}
Critical Alerts: ${reportData.criticalAlerts}
Status: ${reportData.criticalAlerts > 0 ? 'Needs Attention' : 'Normal'}

Full report available in your dashboard.`;
  }

  private checkRateLimit(phoneNumber: string): boolean {
    const now = Date.now();
    const key = phoneNumber;
    
    // Clean up expired entries
    Array.from(this.rateLimiter.entries()).forEach(([k, v]) => {
      if (now > v.resetTime) {
        this.rateLimiter.delete(k);
      }
    });

    const limit = this.rateLimiter.get(key);
    
    if (!limit) {
      // First message in the window
      this.rateLimiter.set(key, { count: 1, resetTime: now + (60 * 1000) }); // 1 minute window
      return true;
    }

    if (limit.count >= 10) { // Max 10 messages per minute per number
      return false;
    }

    limit.count++;
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      this.fromNumber
    );
  }

  getConfiguration(): {
    accountSid: string;
    fromNumber: string;
    webhookUrl: string;
    configured: boolean;
  } {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? '***' + process.env.TWILIO_ACCOUNT_SID.slice(-4) : 'Not set',
      fromNumber: this.fromNumber || 'Not set',
      webhookUrl: this.webhookUrl || 'Not set',
      configured: this.isConfigured()
    };
  }
}

export default new TwilioSMSService();