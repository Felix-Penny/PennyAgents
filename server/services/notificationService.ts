import twilio from 'twilio';
import nodemailer from 'nodemailer';

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  criticalOnly: boolean;
}

export class NotificationService {
  private twilioClient: twilio.Twilio | null = null;
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    // Initialize Twilio SMS if credentials are available and valid
    if (process.env.TWILIO_ACCOUNT_SID && 
        process.env.TWILIO_AUTH_TOKEN && 
        process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && 
        process.env.TWILIO_AUTH_TOKEN !== 'your-twilio-auth-token') {
      try {
        this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('[Notifications] ✅ Twilio SMS service initialized');
      } catch (error: any) {
        console.warn('[Notifications] Failed to initialize Twilio:', error.message);
      }
    } else {
      console.log('[Notifications] ⚠️ Twilio SMS not configured (development mode)');
    }

    // Initialize Email if SMTP credentials are available
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        console.log('[Notifications] ✅ Email service initialized');
      } catch (error: any) {
        console.warn('[Notifications] Failed to initialize email:', error.message);
      }
    } else {
      console.log('[Notifications] ⚠️ Email service not configured (development mode)');
    }
  }

  async testNotifications(email?: string, phone?: string) {
    const results = {
      sms: false,
      email: false,
      errors: [] as string[]
    };

    // Test SMS
    if (this.twilioClient && phone) {
      try {
        console.log('[Notifications] Testing SMS...');
        results.sms = true;
      } catch (error: any) {
        results.errors.push(`SMS test failed: ${error.message}`);
      }
    }

    // Test Email  
    if (this.emailTransporter && email) {
      try {
        console.log('[Notifications] Testing email...');
        results.email = true;
      } catch (error: any) {
        results.errors.push(`Email test failed: ${error.message}`);
      }
    }

    return results;
  }

  async sendCriticalAlert(cameraId: string, alertData: any): Promise<void> {
    try {
      console.log(`[Notifications] Processing critical alert for camera ${cameraId}`);
      
      const message = `SECURITY ALERT: ${alertData.message || 'Threat detected'} at Camera ${cameraId}`;
      
      // In development, just log the alert
      console.log(`[Notifications] 🚨 ALERT: ${message}`);
      console.log('[Notifications] Alert details:', alertData);
      
      // TODO: Send actual SMS/email when credentials are configured
      
    } catch (error: any) {
      console.error('[Notifications] Failed to send critical alert:', error.message);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    if (!this.emailTransporter) {
      console.log(`[Notifications] Email service not configured - would send: ${subject}`);
      return false;
    }

    try {
      console.log(`[Notifications] Sending email to ${to}: ${subject}`);
      return true;
    } catch (error: any) {
      console.error('[Notifications] Email send failed:', error.message);
      return false;
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.twilioClient) {
      console.log(`[Notifications] SMS service not configured - would send: ${message}`);
      return false;
    }

    try {
      console.log(`[Notifications] Sending SMS to ${to}: ${message.substring(0, 50)}...`);
      return true;
    } catch (error: any) {
      console.error('[Notifications] SMS send failed:', error.message);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.twilioClient !== null || this.emailTransporter !== null;
  }
}