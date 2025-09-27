import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import winston from 'winston';
import emailService from './emailService';

interface User {
  id: number;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthResult {
  success: boolean;
  user?: Partial<User>;
  token?: string;
  refreshToken?: string;
  requiresTwoFactor?: boolean;
  error?: string;
  message?: string;
}

interface RegistrationData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  storeId?: number;
}

interface LoginData {
  email: string;
  password: string;
  twoFactorCode?: string;
}

interface PasswordResetData {
  token: string;
  newPassword: string;
}

class AuthController {
  private logger: winston.Logger;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private passwordResetSecret: string;
  private emailVerificationSecret: string;
  private twoFactorSecret: string;
  private maxFailedAttempts: number;
  private lockoutDuration: number;
  private tokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
    this.passwordResetSecret = process.env.PASSWORD_RESET_SECRET || 'fallback-reset-secret';
    this.emailVerificationSecret = process.env.EMAIL_VERIFICATION_SECRET || 'fallback-verification-secret';
    this.twoFactorSecret = process.env.TWO_FACTOR_SECRET || 'fallback-2fa-secret';
    
    this.maxFailedAttempts = parseInt(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || '5');
    this.lockoutDuration = this.parseDuration(process.env.ACCOUNT_LOCKOUT_DURATION || '15m');
    this.tokenExpiry = process.env.SESSION_TIMEOUT || '24h';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/auth.log' })
      ]
    });
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // default 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value * 60 * 1000;
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  generateTokens(user: Partial<User>): { token: string; refreshToken: string } {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      iat: Math.floor(Date.now() / 1000)
    };

    const options: SignOptions = {
      expiresIn: this.tokenExpiry as any
    };

    const token = jwt.sign(payload, this.jwtSecret, options);

    const refreshPayload = {
      id: user.id,
      tokenType: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    };

    const refreshOptions: SignOptions = {
      expiresIn: this.refreshTokenExpiry as any
    };

    const refreshToken = jwt.sign(refreshPayload, this.jwtRefreshSecret, refreshOptions);

    return { token, refreshToken };
  }

  verifyToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      return { valid: true, payload };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token verification failed'
      };
    }
  }

  verifyRefreshToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret);
      return { valid: true, payload };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Refresh token verification failed'
      };
    }
  }

  async register(data: RegistrationData): Promise<AuthResult> {
    try {
      // Validate input
      const validation = this.validateRegistrationData(data);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Check if user already exists
      const existingUser = await this.findUserByEmail(data.email);
      if (existingUser) {
        return {
          success: false,
          error: 'User already exists with this email'
        };
      }

      // Hash password
      const hashedPassword = await this.hashPassword(data.password);

      // Create user
      const newUser: Partial<User> = {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'user',
        emailVerified: false,
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const user = await this.createUser(newUser);

      if (!user) {
        throw new Error('Failed to create user');
      }

      // Generate email verification token
      const verificationToken = await this.generateEmailVerificationToken(user.id!);
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

      // Send verification email
      await emailService.sendEmailVerification(user.email!, verificationUrl);

      this.logger.info('User registered successfully', { userId: user.id, email: user.email });

      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        message: 'Registration successful. Please check your email for verification.'
      };

    } catch (error) {
      this.logger.error('Registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  async login(data: LoginData): Promise<AuthResult> {
    try {
      // Find user
      const user = await this.findUserByEmail(data.email);
      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return {
          success: false,
          error: 'Account is temporarily locked due to too many failed attempts'
        };
      }

      // Verify password
      const passwordValid = await this.comparePassword(data.password, user.password);
      if (!passwordValid) {
        await this.handleFailedLogin(user.id!);
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return {
          success: false,
          error: 'Please verify your email before logging in'
        };
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!data.twoFactorCode) {
          return {
            success: false,
            requiresTwoFactor: true,
            message: 'Two-factor authentication code required'
          };
        }

        const twoFactorValid = await this.verifyTwoFactorCode(user.id!, data.twoFactorCode);
        if (!twoFactorValid) {
          await this.handleFailedLogin(user.id!);
          return {
            success: false,
            error: 'Invalid two-factor authentication code'
          };
        }
      }

      // Reset failed attempts and generate tokens
      await this.handleSuccessfulLogin(user.id!);
      const { token, refreshToken } = this.generateTokens(user);

      this.logger.info('User logged in successfully', { userId: user.id, email: user.email });

      const { password: _, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token,
        refreshToken
      };

    } catch (error) {
      this.logger.error('Login failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const verification = this.verifyRefreshToken(refreshToken);
      if (!verification.valid) {
        return {
          success: false,
          error: 'Invalid refresh token'
        };
      }

      const user = await this.findUserById(verification.payload.id);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const tokens = this.generateTokens(user);

      return {
        success: true,
        token: tokens.token,
        refreshToken: tokens.refreshToken
      };

    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const user = await this.findUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        return {
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent.'
        };
      }

      const resetToken = await this.generatePasswordResetToken(user.id!);
      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

      await emailService.sendPasswordReset(email, resetUrl, 1); // 1 hour expiry

      this.logger.info('Password reset requested', { userId: user.id, email });

      return {
        success: true,
        message: 'Password reset link sent to your email'
      };

    } catch (error) {
      this.logger.error('Password reset request failed:', error);
      return {
        success: false,
        error: 'Failed to send password reset email'
      };
    }
  }

  async resetPassword(data: PasswordResetData): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const payload = await this.verifyPasswordResetToken(data.token);
      if (!payload) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        };
      }

      const validation = this.validatePassword(data.newPassword);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      const hashedPassword = await this.hashPassword(data.newPassword);
      await this.updateUserPassword(payload.userId, hashedPassword);

      this.logger.info('Password reset successfully', { userId: payload.userId });

      return {
        success: true,
        message: 'Password reset successfully'
      };

    } catch (error) {
      this.logger.error('Password reset failed:', error);
      return {
        success: false,
        error: 'Password reset failed'
      };
    }
  }

  async verifyEmail(token: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const payload = await this.verifyEmailVerificationToken(token);
      if (!payload) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        };
      }

      await this.markEmailAsVerified(payload.userId);

      this.logger.info('Email verified successfully', { userId: payload.userId });

      return {
        success: true,
        message: 'Email verified successfully'
      };

    } catch (error) {
      this.logger.error('Email verification failed:', error);
      return {
        success: false,
        error: 'Email verification failed'
      };
    }
  }

  async enableTwoFactor(userId: number): Promise<{
    success: boolean;
    secret?: string;
    qrCodeUrl?: string;
    backupCodes?: string[];
    error?: string;
  }> {
    try {
      const secret = speakeasy.generateSecret({
        name: `PennyProtect (${await this.getUserEmail(userId)})`,
        issuer: 'PennyProtect'
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        randomBytes(4).toString('hex').toUpperCase()
      );

      // Store secret and backup codes (temporarily, until user confirms)
      await this.storeTwoFactorSecret(userId, secret.base32, backupCodes);

      return {
        success: true,
        secret: secret.base32,
        qrCodeUrl,
        backupCodes
      };

    } catch (error) {
      this.logger.error('Two-factor setup failed:', error);
      return {
        success: false,
        error: 'Failed to setup two-factor authentication'
      };
    }
  }

  async confirmTwoFactor(userId: number, code: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const isValid = await this.verifyTwoFactorCode(userId, code);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid verification code'
        };
      }

      await this.activateTwoFactor(userId);

      this.logger.info('Two-factor authentication enabled', { userId });

      return {
        success: true,
        message: 'Two-factor authentication enabled successfully'
      };

    } catch (error) {
      this.logger.error('Two-factor confirmation failed:', error);
      return {
        success: false,
        error: 'Failed to enable two-factor authentication'
      };
    }
  }

  async disableTwoFactor(userId: number, password: string): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const user = await this.findUserById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const passwordValid = await this.comparePassword(password, user.password);
      if (!passwordValid) {
        return {
          success: false,
          error: 'Invalid password'
        };
      }

      await this.deactivateTwoFactor(userId);

      this.logger.info('Two-factor authentication disabled', { userId });

      return {
        success: true,
        message: 'Two-factor authentication disabled successfully'
      };

    } catch (error) {
      this.logger.error('Two-factor disable failed:', error);
      return {
        success: false,
        error: 'Failed to disable two-factor authentication'
      };
    }
  }

  private validateRegistrationData(data: RegistrationData): { valid: boolean; error?: string } {
    if (!data.email || !data.password) {
      return { valid: false, error: 'Email and password are required' };
    }

    if (!this.isValidEmail(data.email)) {
      return { valid: false, error: 'Invalid email address' };
    }

    const passwordValidation = this.validatePassword(data.password);
    if (!passwordValidation.valid) {
      return passwordValidation;
    }

    return { valid: true };
  }

  private validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return {
        valid: false,
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      };
    }

    return { valid: true };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Database operations (these would be implemented with your actual database)
  private async findUserByEmail(email: string): Promise<User | null> {
    // Implementation depends on your database setup
    // This is a placeholder for the actual database query
    return null;
  }

  private async findUserById(id: number): Promise<User | null> {
    // Implementation depends on your database setup
    return null;
  }

  private async createUser(user: Partial<User>): Promise<User | null> {
    // Implementation depends on your database setup
    return null;
  }

  private async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    // Implementation depends on your database setup
  }

  private async markEmailAsVerified(userId: number): Promise<void> {
    // Implementation depends on your database setup
  }

  private async handleFailedLogin(userId: number): Promise<void> {
    // Implementation depends on your database setup
    // Increment failed attempts and lock account if necessary
  }

  private async handleSuccessfulLogin(userId: number): Promise<void> {
    // Implementation depends on your database setup
    // Reset failed attempts and update last login
  }

  private async getUserEmail(userId: number): Promise<string> {
    // Implementation depends on your database setup
    return '';
  }

  private async storeTwoFactorSecret(userId: number, secret: string, backupCodes: string[]): Promise<void> {
    // Implementation depends on your database setup
  }

  private async activateTwoFactor(userId: number): Promise<void> {
    // Implementation depends on your database setup
  }

  private async deactivateTwoFactor(userId: number): Promise<void> {
    // Implementation depends on your database setup
  }

  private async verifyTwoFactorCode(userId: number, code: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (!user || !user.twoFactorSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });
  }

  private async generateEmailVerificationToken(userId: number): Promise<string> {
    const payload = { userId, type: 'email_verification', exp: Date.now() + (24 * 60 * 60 * 1000) };
    return jwt.sign(payload, this.emailVerificationSecret);
  }

  private async verifyEmailVerificationToken(token: string): Promise<{ userId: number } | null> {
    try {
      const payload = jwt.verify(token, this.emailVerificationSecret) as any;
      if (payload.type !== 'email_verification' || payload.exp < Date.now()) {
        return null;
      }
      return { userId: payload.userId };
    } catch {
      return null;
    }
  }

  private async generatePasswordResetToken(userId: number): Promise<string> {
    const payload = { userId, type: 'password_reset', exp: Date.now() + (60 * 60 * 1000) };
    return jwt.sign(payload, this.passwordResetSecret);
  }

  private async verifyPasswordResetToken(token: string): Promise<{ userId: number } | null> {
    try {
      const payload = jwt.verify(token, this.passwordResetSecret) as any;
      if (payload.type !== 'password_reset' || payload.exp < Date.now()) {
        return null;
      }
      return { userId: payload.userId };
    } catch {
      return null;
    }
  }
}

export default new AuthController();