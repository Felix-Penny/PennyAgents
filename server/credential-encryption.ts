// Camera Credential Encryption - Security-first credential management
import { randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';

/**
 * Encrypted Credential Structure
 */
interface EncryptedCredentialData {
  version: string;
  keyId: string;
  iv: string; // base64
  ciphertext: string; // base64
  tag: string; // base64
  checksum: string; // SHA-256 checksum for integrity
}

/**
 * Camera Authentication Configuration
 */
export interface CameraAuthConfig {
  type: 'none' | 'basic' | 'digest' | 'token' | 'oauth';
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  oauth?: {
    clientId: string;
    clientSecret: string;
    authUrl: string;
    tokenUrl: string;
  };
}

/**
 * Stream Access Token for signed URLs
 */
export interface StreamAccessToken {
  cameraId: string;
  userId: string;
  storeId: string;
  permissions: string[];
  expiresAt: number;
  nonce: string;
}

/**
 * CredentialEncryption - Handles secure encryption of camera credentials
 * 
 * CRITICAL SECURITY FEATURES:
 * - All camera credentials MUST be encrypted at rest
 * - Uses industry-standard AES-256-GCM encryption with proper authentication
 * - Key management through KMS (expandable for actual KMS integration)
 * - Audit trail for all encryption/decryption operations
 * - Tamper detection via authenticated encryption
 * - Credentials never exposed to client-side code
 */
export class CredentialEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12; // 96 bits for GCM mode
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly STREAM_TOKEN_SECRET = process.env.STREAM_TOKEN_SECRET || 'change-in-production-stream-secret';

  /**
   * Encrypt camera credentials with KMS-managed key
   * @param authConfig - Camera authentication configuration
   * @param cameraId - Camera identifier for key scoping
   * @returns Encrypted configuration string
   */
  static async encryptCredentials(authConfig: CameraAuthConfig, cameraId: string): Promise<string> {
    try {
      // Don't encrypt if no credentials are present
      if (authConfig.type === 'none' || !this.hasCredentials(authConfig)) {
        return JSON.stringify(authConfig);
      }

      const keyId = await this.generateCredentialKey(cameraId);
      const key = await this.getCredentialKey(keyId);
      
      // Serialize sensitive data
      const sensitiveData = JSON.stringify(this.extractSensitiveFields(authConfig));
      
      // Generate random IV for this encryption
      const iv = randomBytes(this.IV_LENGTH);
      
      // Create cipher with AES-256-GCM
      const cipher = createCipheriv(this.ALGORITHM, key, iv);
      
      // Encrypt the sensitive data
      let ciphertext = cipher.update(sensitiveData, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      
      // Get authentication tag for integrity protection
      const tag = cipher.getAuthTag();
      
      // Generate checksum for additional integrity verification
      const checksum = createHash('sha256')
        .update(sensitiveData)
        .digest('hex');
      
      // Create encrypted credential structure
      const encryptedData: EncryptedCredentialData = {
        version: '2.0',
        keyId,
        iv: iv.toString('base64'),
        ciphertext,
        tag: tag.toString('base64'),
        checksum
      };
      
      // Return non-sensitive fields with encrypted sensitive data
      const nonSensitiveConfig = this.createNonSensitiveConfig(authConfig);
      return JSON.stringify({
        ...nonSensitiveConfig,
        __encrypted: JSON.stringify(encryptedData)
      });
    } catch (error) {
      console.error('Credential encryption failed:', error);
      throw new Error('Failed to encrypt camera credentials');
    }
  }

  /**
   * Decrypt camera credentials with integrity validation
   * @param encryptedConfig - Encrypted configuration string
   * @param cameraId - Camera identifier for validation
   * @returns Decrypted authentication configuration
   */
  static async decryptCredentials(encryptedConfig: string, cameraId: string): Promise<CameraAuthConfig> {
    try {
      const config = JSON.parse(encryptedConfig);
      
      // Return as-is if not encrypted
      if (!config.__encrypted) {
        return config as CameraAuthConfig;
      }
      
      const encryptedData: EncryptedCredentialData = JSON.parse(config.__encrypted);
      
      // Validate version
      if (encryptedData.version !== '2.0') {
        throw new Error('Unsupported credential encryption version');
      }
      
      // Retrieve the key
      const key = await this.getCredentialKey(encryptedData.keyId);
      
      // Parse base64 encoded components
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      
      // Create decipher with AES-256-GCM
      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt the sensitive data with integrity verification
      let decrypted = decipher.update(encryptedData.ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Verify checksum for additional integrity check
      const expectedChecksum = createHash('sha256')
        .update(decrypted)
        .digest('hex');
      
      if (!timingSafeEqual(Buffer.from(encryptedData.checksum, 'hex'), Buffer.from(expectedChecksum, 'hex'))) {
        throw new Error('Credential integrity verification failed - data may be tampered');
      }
      
      // Parse decrypted sensitive data
      const sensitiveFields = JSON.parse(decrypted);
      
      // Remove __encrypted field and merge with sensitive fields
      const { __encrypted, ...nonSensitiveConfig } = config;
      return {
        ...nonSensitiveConfig,
        ...sensitiveFields
      } as CameraAuthConfig;
    } catch (error) {
      console.error('Credential decryption failed:', error);
      if (error instanceof Error && error.message.includes('auth')) {
        throw new Error('Credential integrity verification failed - data may be tampered');
      }
      throw new Error('Failed to decrypt camera credentials');
    }
  }

  /**
   * Generate signed stream access token
   * @param cameraId - Camera identifier
   * @param userId - User identifier
   * @param storeId - Store identifier  
   * @param permissions - Stream permissions
   * @param expirationMinutes - Token expiration in minutes (default: 60)
   * @returns Signed access token
   */
  static generateStreamToken(
    cameraId: string, 
    userId: string, 
    storeId: string, 
    permissions: string[], 
    expirationMinutes: number = 60
  ): string {
    const tokenData: StreamAccessToken = {
      cameraId,
      userId,
      storeId,
      permissions,
      expiresAt: Date.now() + (expirationMinutes * 60 * 1000),
      nonce: randomUUID()
    };
    
    const payload = Buffer.from(JSON.stringify(tokenData)).toString('base64url');
    const signature = this.signPayload(payload);
    
    return `${payload}.${signature}`;
  }

  /**
   * Validate and parse signed stream access token
   * @param token - Signed access token
   * @returns Parsed token data or null if invalid
   */
  static validateStreamToken(token: string): StreamAccessToken | null {
    try {
      const [payload, signature] = token.split('.');
      
      if (!payload || !signature) {
        return null;
      }
      
      // Verify signature
      const expectedSignature = this.signPayload(payload);
      if (!timingSafeEqual(Buffer.from(signature, 'base64url'), Buffer.from(expectedSignature, 'base64url'))) {
        return null;
      }
      
      // Parse payload
      const tokenData: StreamAccessToken = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      
      // Check expiration
      if (Date.now() > tokenData.expiresAt) {
        return null;
      }
      
      return tokenData;
    } catch (error) {
      console.error('Stream token validation failed:', error);
      return null;
    }
  }

  /**
   * Extract sensitive fields from auth config
   */
  private static extractSensitiveFields(authConfig: CameraAuthConfig): Partial<CameraAuthConfig> {
    const sensitive: Partial<CameraAuthConfig> = {};
    
    if (authConfig.password) sensitive.password = authConfig.password;
    if (authConfig.token) sensitive.token = authConfig.token;
    if (authConfig.apiKey) sensitive.apiKey = authConfig.apiKey;
    if (authConfig.oauth?.clientSecret) {
      sensitive.oauth = { ...authConfig.oauth, clientSecret: authConfig.oauth.clientSecret };
    }
    
    return sensitive;
  }

  /**
   * Create non-sensitive config (safe to store/transmit)
   */
  private static createNonSensitiveConfig(authConfig: CameraAuthConfig): Partial<CameraAuthConfig> {
    const nonSensitive: Partial<CameraAuthConfig> = {
      type: authConfig.type
    };
    
    if (authConfig.username) nonSensitive.username = authConfig.username;
    if (authConfig.oauth) {
      const { clientSecret, ...safeOauth } = authConfig.oauth;
      nonSensitive.oauth = safeOauth;
    }
    
    return nonSensitive;
  }

  /**
   * Check if auth config contains credentials that need encryption
   */
  private static hasCredentials(authConfig: CameraAuthConfig): boolean {
    return !!(
      authConfig.password || 
      authConfig.token || 
      authConfig.apiKey || 
      authConfig.oauth?.clientSecret
    );
  }

  /**
   * Generate credential encryption key for camera
   */
  private static async generateCredentialKey(cameraId: string): Promise<string> {
    return `camera-cred-${cameraId}-${Date.now()}`;
  }

  /**
   * Retrieve credential encryption key
   */
  private static async getCredentialKey(keyId: string): Promise<Buffer> {
    // In production, this would integrate with actual KMS
    const hash = createHash('sha256');
    hash.update(keyId);
    hash.update(process.env.CAMERA_CREDENTIAL_MASTER_KEY || 'default-credential-key-change-in-production');
    return hash.digest();
  }

  /**
   * Sign payload for stream tokens
   */
  private static signPayload(payload: string): string {
    const hmac = createHash('sha256');
    hmac.update(payload);
    hmac.update(this.STREAM_TOKEN_SECRET);
    return hmac.digest('base64url');
  }

  /**
   * Audit log for credential operations (production should log to secure audit system)
   */
  static auditCredentialOperation(operation: string, cameraId: string, userId?: string): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      operation,
      cameraId,
      userId: userId || 'system',
      source: 'credential-encryption'
    };
    
    // In production, this should go to a secure audit logging system
    console.log('[AUDIT] Credential operation:', JSON.stringify(auditEntry));
  }
}

// Utility functions for camera credential management
export const credentialUtils = {
  /**
   * Encrypt camera credentials for storage
   */
  async encryptForStorage(authConfig: CameraAuthConfig, cameraId: string): Promise<string> {
    CredentialEncryption.auditCredentialOperation('encrypt', cameraId);
    return await CredentialEncryption.encryptCredentials(authConfig, cameraId);
  },

  /**
   * Decrypt camera credentials from storage
   */
  async decryptFromStorage(encryptedConfig: string, cameraId: string): Promise<CameraAuthConfig> {
    CredentialEncryption.auditCredentialOperation('decrypt', cameraId);
    return await CredentialEncryption.decryptCredentials(encryptedConfig, cameraId);
  },

  /**
   * Create safe auth config for client (no sensitive data)
   */
  createSafeAuthConfig(authConfig: CameraAuthConfig): Partial<CameraAuthConfig> {
    return {
      type: authConfig.type,
      username: authConfig.username,
      oauth: authConfig.oauth ? {
        clientId: authConfig.oauth.clientId,
        authUrl: authConfig.oauth.authUrl,
        tokenUrl: authConfig.oauth.tokenUrl
        // clientSecret intentionally omitted
      } : undefined
    };
  },

  /**
   * Generate signed stream URL
   */
  generateSignedStreamUrl(
    cameraId: string, 
    userId: string, 
    storeId: string, 
    permissions: string[],
    protocol: 'hls' | 'webrtc' | 'mjpeg' = 'hls'
  ): string {
    const token = CredentialEncryption.generateStreamToken(cameraId, userId, storeId, permissions);
    return `/api/stream/${protocol}/${cameraId}?token=${token}`;
  }
};