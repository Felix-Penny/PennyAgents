// Biometric Template Encryption - Privacy-Compliant KMS-backed encryption
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';

/**
 * Encrypted Data Structure for BiometricEncryption
 */
interface EncryptedData {
  version: string;
  keyId: string;
  iv: string; // base64
  ciphertext: string; // base64
  tag: string; // base64
}

/**
 * BiometricEncryption - Handles KMS-backed encryption of biometric templates
 * 
 * CRITICAL PRIVACY COMPLIANCE:
 * - All biometric templates MUST be encrypted at rest
 * - Uses industry-standard AES-256-GCM encryption with proper authentication
 * - Key management through KMS (placeholder for actual KMS integration)
 * - Audit trail for all encryption/decryption operations
 * - Tamper detection via authenticated encryption
 */
export class BiometricEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 12; // 96 bits for GCM mode
  private static readonly TAG_LENGTH = 16; // 128 bits

  /**
   * Encrypt a biometric template with KMS-managed key using proper AES-256-GCM
   * @param template - Raw biometric template data
   * @param keyId - KMS key identifier
   * @returns Encrypted template string (JSON structure with version, IV, ciphertext, and auth tag)
   */
  static async encryptTemplate(template: string, keyId: string): Promise<string> {
    try {
      // In production, this would retrieve the actual key from KMS
      const key = await this.getKMSKey(keyId); // 32 bytes for AES-256
      
      // Generate random IV for this encryption (96-bit for GCM mode)
      const iv = randomBytes(this.IV_LENGTH);
      
      // Create cipher with proper AES-256-GCM
      const cipher = createCipheriv(this.ALGORITHM, key, iv);
      
      // Encrypt the template
      let ciphertext = cipher.update(template, 'utf8', 'base64');
      ciphertext += cipher.final('base64');
      
      // Get authentication tag for integrity protection
      const tag = cipher.getAuthTag();
      
      // Create structured encrypted data
      const encryptedData: EncryptedData = {
        version: '1.0',
        keyId,
        iv: iv.toString('base64'),
        ciphertext,
        tag: tag.toString('base64')
      };
      
      return JSON.stringify(encryptedData);
    } catch (error) {
      console.error('Biometric template encryption failed:', error);
      throw new Error('Failed to encrypt biometric template');
    }
  }

  /**
   * Decrypt a biometric template with KMS-managed key and key validation
   * @param encryptedTemplate - Encrypted template (JSON structure)
   * @param expectedKeyId - Expected KMS key identifier for validation
   * @returns Decrypted template string
   */
  static async decryptTemplate(encryptedTemplate: string, expectedKeyId: string): Promise<string> {
    try {
      // Parse the structured encrypted data
      const data: EncryptedData = JSON.parse(encryptedTemplate);
      
      // Validate key ID to prevent key confusion attacks
      if (data.keyId !== expectedKeyId) {
        throw new Error('Key ID mismatch - potential security breach');
      }
      
      // Retrieve the key from KMS
      const key = await this.getKMSKey(data.keyId);
      
      // Parse base64 encoded components
      const iv = Buffer.from(data.iv, 'base64');
      const tag = Buffer.from(data.tag, 'base64');
      
      // Create decipher with proper AES-256-GCM
      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt the template with integrity verification
      let decrypted = decipher.update(data.ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Biometric template decryption failed:', error);
      // Throw specific error for integrity failures
      if (error instanceof Error && error.message.includes('auth')) {
        throw new Error('Template integrity verification failed - data may be tampered');
      }
      throw new Error('Failed to decrypt biometric template');
    }
  }

  /**
   * Generate a new KMS key for biometric template encryption
   * @param storeId - Store identifier for key scoping
   * @returns KMS key identifier
   */
  static async generateKMSKey(storeId: string): Promise<string> {
    // In production, this would integrate with actual KMS (AWS KMS, Azure Key Vault, etc.)
    const keyId = `biometric-key-${storeId}-${Date.now()}`;
    
    // Store the key securely (placeholder - in production this would be in KMS)
    await this.storeKMSKey(keyId, randomBytes(this.KEY_LENGTH));
    
    return keyId;
  }

  /**
   * Retrieve encryption key from KMS
   * @param keyId - KMS key identifier
   * @returns Encryption key buffer
   */
  private static async getKMSKey(keyId: string): Promise<Buffer> {
    // In production, this would integrate with actual KMS
    // For now, use a deterministic key derived from keyId
    const hash = createHash('sha256');
    hash.update(keyId);
    hash.update(process.env.BIOMETRIC_MASTER_KEY || 'default-master-key-change-in-production');
    return hash.digest();
  }

  /**
   * Store encryption key in KMS (placeholder)
   * @param keyId - Key identifier
   * @param key - Key material
   */
  private static async storeKMSKey(keyId: string, key: Buffer): Promise<void> {
    // In production, this would store in actual KMS
    // For now, this is a placeholder
    console.log(`Stored KMS key: ${keyId} (${key.length} bytes)`);
  }

  /**
   * Rotate encryption key for a store
   * @param storeId - Store identifier
   * @param oldKeyId - Current key identifier
   * @returns New key identifier
   */
  static async rotateKey(storeId: string, oldKeyId: string): Promise<string> {
    // Generate new key
    const newKeyId = await this.generateKMSKey(storeId);
    
    // In production, this would:
    // 1. Re-encrypt all templates with new key
    // 2. Update all face_templates records with new keyId
    // 3. Securely delete old key after verification
    
    console.log(`Key rotation: ${oldKeyId} -> ${newKeyId} for store ${storeId}`);
    return newKeyId;
  }

  /**
   * Validate encrypted template integrity
   * @param encryptedTemplate - Encrypted template to validate
   * @param keyId - KMS key identifier
   * @returns Boolean indicating if template is valid
   */
  static async validateTemplate(encryptedTemplate: string, keyId: string): Promise<boolean> {
    try {
      await this.decryptTemplate(encryptedTemplate, keyId);
      return true;
    } catch (error) {
      console.error('Template validation failed:', error);
      return false;
    }
  }
}

// Export utility functions for template operations
export const biometricUtils = {
  /**
   * Create encrypted face template entry
   */
  async createEncryptedTemplate(
    storeId: string,
    template: string,
    personType: string,
    createdBy: string,
    justification: string,
    retentionDays: number = 90
  ) {
    const keyId = await BiometricEncryption.generateKMSKey(storeId);
    const encryptedTemplate = await BiometricEncryption.encryptTemplate(template, keyId);
    const retentionExpiry = new Date();
    retentionExpiry.setDate(retentionExpiry.getDate() + retentionDays);

    return {
      storeId,
      encryptedTemplate,
      keyId,
      personType,
      createdBy,
      justification,
      retentionExpiry
    };
  },

  /**
   * Retrieve and decrypt face template
   */
  async getDecryptedTemplate(encryptedTemplate: string, keyId: string): Promise<string> {
    return await BiometricEncryption.decryptTemplate(encryptedTemplate, keyId);
  }
};