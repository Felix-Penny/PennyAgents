import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';

interface EmailMessage {
  to: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  template?: string;
  templateData?: any;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'low' | 'normal' | 'high';
  category?: 'alert' | 'notification' | 'report' | 'verification' | 'marketing' | 'test';
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  to?: string | string[];
}

interface BulkEmailResult {
  success: boolean;
  results: EmailResult[];
  totalSent: number;
  totalFailed: number;
  errors: string[];
}

interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

class EmailService {
  private provider: 'smtp' | 'sendgrid' | 'aws-ses';
  private smtpTransporter?: nodemailer.Transporter;
  private sesClient?: SESv2Client;
  private logger: winston.Logger;
  private templates: Map<string, EmailTemplate>;
  private templateDir: string;

  constructor() {
    this.provider = (process.env.EMAIL_PROVIDER as any) || 'smtp';
    this.templateDir = process.env.EMAIL_TEMPLATE_DIR || './server/templates/email';
    this.templates = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/email.log' })
      ]
    });

    this.initializeProvider();
    this.loadTemplates();
  }

  private async initializeProvider(): Promise<void> {
    try {
      switch (this.provider) {
        case 'smtp':
          await this.initializeSMTP();
          break;
        case 'sendgrid':
          this.initializeSendGrid();
          break;
        case 'aws-ses':
          this.initializeAWSSES();
          break;
        default:
          this.logger.warn(`Unknown email provider: ${this.provider}, falling back to SMTP`);
          await this.initializeSMTP();
      }
    } catch (error) {
      this.logger.error('Failed to initialize email provider:', error);
    }
  }

  private async initializeSMTP(): Promise<void> {
    this.smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    });

    // Verify SMTP connection
    if (this.smtpTransporter) {
      try {
        await this.smtpTransporter.verify();
        this.logger.info('SMTP connection verified');
      } catch (error) {
        this.logger.error('SMTP connection failed:', error);
      }
    }
  }

  private initializeSendGrid(): void {
    const apiKey = process.env.SENDGRID_API_KEY || '';
    sgMail.setApiKey(apiKey);
    this.logger.info('SendGrid initialized');
  }

  private initializeAWSSES(): void {
    this.sesClient = new SESv2Client({
      region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
    this.logger.info('AWS SES initialized');
  }

  private loadTemplates(): void {
    if (!fs.existsSync(this.templateDir)) {
      this.logger.warn(`Template directory not found: ${this.templateDir}`);
      this.createDefaultTemplates();
      return;
    }

    try {
      const files = fs.readdirSync(this.templateDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const templatePath = path.join(this.templateDir, file);
          const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
          const templateName = path.basename(file, '.json');
          
          this.templates.set(templateName, templateData);
          this.logger.info(`Loaded email template: ${templateName}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to load email templates:', error);
      this.createDefaultTemplates();
    }
  }

  private createDefaultTemplates(): void {
    // Ensure template directory exists
    if (!fs.existsSync(this.templateDir)) {
      fs.mkdirSync(this.templateDir, { recursive: true });
    }

    const defaultTemplates = [
      {
        name: 'security-alert',
        subject: '🚨 Security Alert - {{alertType}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d32f2f;">🚨 Security Alert</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>{{alertType}}</h3>
              <p><strong>Location:</strong> {{location}}</p>
              <p><strong>Time:</strong> {{timestamp}}</p>
              <p><strong>Severity:</strong> <span style="color: {{severityColor}};">{{severity}}</span></p>
            </div>
            <p>{{description}}</p>
            <div style="margin: 30px 0;">
              <a href="{{dashboardUrl}}" style="background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Dashboard</a>
            </div>
          </div>
        `,
        text: `Security Alert: {{alertType}}\n\nLocation: {{location}}\nTime: {{timestamp}}\nSeverity: {{severity}}\n\n{{description}}\n\nView your dashboard: {{dashboardUrl}}`
      },
      {
        name: 'email-verification',
        subject: 'Verify your PennyProtect email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to PennyProtect!</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="margin: 30px 0;">
              <a href="{{verificationUrl}}" style="background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Verify Email</a>
            </div>
            <p>If you didn't create this account, please ignore this email.</p>
            <p>This link expires in {{expiresIn}} hours.</p>
          </div>
        `,
        text: `Welcome to PennyProtect!\n\nPlease verify your email by visiting: {{verificationUrl}}\n\nThis link expires in {{expiresIn}} hours.`
      },
      {
        name: 'password-reset',
        subject: 'Reset your PennyProtect password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <div style="margin: 30px 0;">
              <a href="{{resetUrl}}" style="background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a>
            </div>
            <p>If you didn't request this, please ignore this email.</p>
            <p>This link expires in {{expiresIn}} hours.</p>
          </div>
        `,
        text: `Password Reset Request\n\nReset your password by visiting: {{resetUrl}}\n\nThis link expires in {{expiresIn}} hours.`
      },
      {
        name: 'weekly-report',
        subject: '📊 Weekly Security Report - {{location}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>📊 Weekly Security Report</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>{{location}}</h3>
              <p><strong>Period:</strong> {{weekStart}} - {{weekEnd}}</p>
            </div>
            <div style="display: flex; gap: 20px; margin: 20px 0;">
              <div style="flex: 1; text-align: center; background: #e3f2fd; padding: 15px; border-radius: 8px;">
                <h4 style="margin: 0; color: #1976d2;">{{totalAlerts}}</h4>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Total Alerts</p>
              </div>
              <div style="flex: 1; text-align: center; background: #ffebee; padding: 15px; border-radius: 8px;">
                <h4 style="margin: 0; color: #d32f2f;">{{criticalAlerts}}</h4>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Critical Alerts</p>
              </div>
            </div>
            <div style="margin: 30px 0;">
              <a href="{{reportUrl}}" style="background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View Full Report</a>
            </div>
          </div>
        `,
        text: `Weekly Security Report\n\n{{location}}\nPeriod: {{weekStart}} - {{weekEnd}}\n\nTotal Alerts: {{totalAlerts}}\nCritical Alerts: {{criticalAlerts}}\n\nView full report: {{reportUrl}}`
      }
    ];

    defaultTemplates.forEach(template => {
      const filePath = path.join(this.templateDir, `${template.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
      this.templates.set(template.name, template);
    });

    this.logger.info('Created default email templates');
  }

  async sendEmail(message: EmailMessage): Promise<EmailResult> {
    try {
      // Process template if specified
      let processedMessage = message;
      if (message.template) {
        processedMessage = await this.processTemplate(message);
      }

      // Ensure subject is set
      if (!processedMessage.subject) {
        processedMessage.subject = 'PennyProtect Notification';
      }

      switch (this.provider) {
        case 'smtp':
          return await this.sendViaSMTP(processedMessage);
        case 'sendgrid':
          return await this.sendViaSendGrid(processedMessage);
        case 'aws-ses':
          return await this.sendViaAWSSES(processedMessage);
        default:
          throw new Error(`Unsupported email provider: ${this.provider}`);
      }
    } catch (error) {
      this.logger.error('Email sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        to: message.to
      };
    }
  }

  private async sendViaSMTP(message: EmailMessage): Promise<EmailResult> {
    if (!this.smtpTransporter) {
      throw new Error('SMTP transporter not initialized');
    }

    const mailOptions = {
      from: process.env.SMTP_USER || '',
      to: Array.isArray(message.to) ? message.to.join(', ') : message.to,
      subject: message.subject || 'No Subject',
      text: message.text,
      html: message.html,
      attachments: message.attachments
    };

    const result = await this.smtpTransporter.sendMail(mailOptions);

    this.logger.info('Email sent via SMTP', {
      messageId: result.messageId,
      to: message.to,
      subject: message.subject
    });

    return {
      success: true,
      messageId: result.messageId,
      to: message.to
    };
  }

  private async sendViaSendGrid(message: EmailMessage): Promise<EmailResult> {
    const sgMessage: any = {
      to: message.to,
      from: process.env.SENDGRID_FROM_EMAIL || '',
      subject: message.subject || 'No Subject',
      text: message.text,
      html: message.html
    };

    if (message.attachments && message.attachments.length > 0) {
      sgMessage.attachments = message.attachments.map(att => ({
        filename: att.filename,
        content: att.content instanceof Buffer ? att.content.toString('base64') : att.content,
        type: att.contentType || 'application/octet-stream',
        disposition: 'attachment'
      }));
    }

    const response = await sgMail.send(sgMessage);

    this.logger.info('Email sent via SendGrid', {
      messageId: response[0].headers['x-message-id'],
      to: message.to,
      subject: message.subject
    });

    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      to: message.to
    };
  }

  private async sendViaAWSSES(message: EmailMessage): Promise<EmailResult> {
    if (!this.sesClient) {
      throw new Error('AWS SES client not initialized');
    }

    const destinations = Array.isArray(message.to) ? message.to : [message.to];

    const command = new SendEmailCommand({
      FromEmailAddress: process.env.AWS_SES_FROM_EMAIL || '',
      Destination: {
        ToAddresses: destinations
      },
      Content: {
        Simple: {
          Subject: {
            Data: message.subject || 'PennyProtect Notification',
            Charset: 'UTF-8'
          },
          Body: {
            Text: message.text ? {
              Data: message.text,
              Charset: 'UTF-8'
            } : undefined,
            Html: message.html ? {
              Data: message.html,
              Charset: 'UTF-8'
            } : undefined
          }
        }
      }
    });

    const response = await this.sesClient.send(command);

    this.logger.info('Email sent via AWS SES', {
      messageId: response.MessageId,
      to: message.to,
      subject: message.subject
    });

    return {
      success: true,
      messageId: response.MessageId,
      to: message.to
    };
  }

  private async processTemplate(message: EmailMessage): Promise<EmailMessage> {
    const template = this.templates.get(message.template!);
    
    if (!template) {
      throw new Error(`Template not found: ${message.template}`);
    }

    const processedMessage = { ...message };
    
    // Process template variables
    if (message.templateData) {
      processedMessage.subject = this.replaceTemplateVariables(template.subject, message.templateData);
      processedMessage.html = this.replaceTemplateVariables(template.html, message.templateData);
      processedMessage.text = this.replaceTemplateVariables(template.text, message.templateData);
    } else {
      processedMessage.subject = template.subject;
      processedMessage.html = template.html;
      processedMessage.text = template.text;
    }

    return processedMessage;
  }

  private replaceTemplateVariables(template: string, data: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  async sendSecurityAlert(email: string, alertData: {
    alertType: string;
    location: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    dashboardUrl: string;
  }): Promise<EmailResult> {
    const severityColors = {
      low: '#ffc107',
      medium: '#ff9800',
      high: '#ff5722',
      critical: '#d32f2f'
    };

    return await this.sendEmail({
      to: email,
      template: 'security-alert',
      templateData: {
        ...alertData,
        timestamp: alertData.timestamp.toLocaleString(),
        severityColor: severityColors[alertData.severity]
      },
      priority: alertData.severity === 'critical' ? 'high' : 'normal',
      category: 'alert'
    });
  }

  async sendEmailVerification(email: string, verificationUrl: string, expiresIn: number = 24): Promise<EmailResult> {
    return await this.sendEmail({
      to: email,
      template: 'email-verification',
      templateData: {
        verificationUrl,
        expiresIn
      },
      category: 'verification'
    });
  }

  async sendPasswordReset(email: string, resetUrl: string, expiresIn: number = 1): Promise<EmailResult> {
    return await this.sendEmail({
      to: email,
      template: 'password-reset',
      templateData: {
        resetUrl,
        expiresIn
      },
      category: 'verification'
    });
  }

  async sendWeeklyReport(email: string, reportData: {
    location: string;
    weekStart: string;
    weekEnd: string;
    totalAlerts: number;
    criticalAlerts: number;
    reportUrl: string;
  }): Promise<EmailResult> {
    return await this.sendEmail({
      to: email,
      template: 'weekly-report',
      templateData: reportData,
      priority: 'low',
      category: 'report'
    });
  }

  async testConnection(): Promise<{ success: boolean; provider: string; error?: string }> {
    try {
      const testResult = await this.sendEmail({
        to: process.env.SMTP_USER || 'test@example.com',
        subject: 'PennyProtect Email Service Test',
        text: 'This is a test email from PennyProtect email service.',
        html: '<p>This is a test email from PennyProtect email service.</p>',
        category: 'test'
      });

      if (testResult.success) {
        return {
          success: true,
          provider: this.provider
        };
      } else {
        return {
          success: false,
          provider: this.provider,
          error: testResult.error
        };
      }
    } catch (error) {
      return {
        success: false,
        provider: this.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  isConfigured(): boolean {
    switch (this.provider) {
      case 'smtp':
        return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
      case 'sendgrid':
        return !!(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
      case 'aws-ses':
        return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_SES_FROM_EMAIL);
      default:
        return false;
    }
  }

  getConfiguration(): {
    provider: string;
    configured: boolean;
    templates: string[];
  } {
    return {
      provider: this.provider,
      configured: this.isConfigured(),
      templates: Array.from(this.templates.keys())
    };
  }
}

export default new EmailService();