import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import winston from 'winston';

interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
  size?: number;
  contentType?: string;
}

interface FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  contentType: string;
  etag: string;
}

interface StorageStats {
  totalFiles: number;
  totalSize: number;
  evidenceFiles: number;
  tempFiles: number;
  oldestFile: Date | null;
  newestFile: Date | null;
}

class S3StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;
  private logger: winston.Logger;
  private localPath: string;
  private useLocalFallback: boolean;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || 'pennyprotect-evidence';
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.localPath = process.env.LOCAL_STORAGE_PATH || './uploads';
    this.useLocalFallback = process.env.STORAGE_PROVIDER === 'hybrid' || process.env.STORAGE_PROVIDER === 'local';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/s3-storage.log' })
      ]
    });

    // Ensure local directories exist if using fallback
    if (this.useLocalFallback) {
      this.ensureLocalDirectories();
    }
  }

  private ensureLocalDirectories(): void {
    const directories = [
      this.localPath,
      path.join(this.localPath, 'evidence'),
      path.join(this.localPath, 'temp'),
      path.join(this.localPath, 'profiles'),
      path.join(this.localPath, 'alerts')
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.info(`Created local directory: ${dir}`);
      }
    });
  }

  private getLocalPath(key: string): string {
    return path.join(this.localPath, key);
  }

  private async storeLocally(buffer: Buffer, key: string, contentType: string): Promise<UploadResult> {
    try {
      const localFilePath = this.getLocalPath(key);
      const dir = path.dirname(localFilePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(localFilePath, buffer);

      this.logger.info(`Stored file locally: ${localFilePath}`);

      return {
        success: true,
        url: `/uploads/${key}`,
        key,
        size: buffer.length,
        contentType
      };
    } catch (error) {
      this.logger.error('Local storage failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async uploadFile(buffer: Buffer, key: string, contentType: string = 'application/octet-stream'): Promise<UploadResult> {
    // Try S3 first if configured
    if (this.isS3Configured() && process.env.STORAGE_PROVIDER !== 'local') {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            uploadedAt: new Date().toISOString(),
            size: buffer.length.toString()
          }
        });

        await this.s3Client.send(command);

        const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
        
        this.logger.info(`Uploaded to S3: ${url}`);

        // Also store locally if hybrid mode
        if (this.useLocalFallback) {
          await this.storeLocally(buffer, key, contentType);
        }

        return {
          success: true,
          url,
          key,
          size: buffer.length,
          contentType
        };
      } catch (error) {
        this.logger.error('S3 upload failed:', error);
        
        // Fall back to local storage
        if (this.useLocalFallback) {
          this.logger.warn('Falling back to local storage');
          return await this.storeLocally(buffer, key, contentType);
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      // Use local storage only
      return await this.storeLocally(buffer, key, contentType);
    }
  }

  async downloadFile(key: string): Promise<{ success: boolean; buffer?: Buffer; error?: string; contentType?: string }> {
    // Try S3 first if configured
    if (this.isS3Configured() && process.env.STORAGE_PROVIDER !== 'local') {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key
        });

        const response = await this.s3Client.send(command);
        const buffer = Buffer.from(await response.Body!.transformToByteArray());

        this.logger.info(`Downloaded from S3: ${key}`);

        return {
          success: true,
          buffer,
          contentType: response.ContentType
        };
      } catch (error) {
        this.logger.error('S3 download failed:', error);
        
        // Fall back to local storage
        if (this.useLocalFallback) {
          this.logger.warn('Falling back to local file');
        } else {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    }

    // Try local storage
    if (this.useLocalFallback) {
      try {
        const localFilePath = this.getLocalPath(key);
        
        if (!fs.existsSync(localFilePath)) {
          return {
            success: false,
            error: 'File not found'
          };
        }

        const buffer = fs.readFileSync(localFilePath);
        
        this.logger.info(`Downloaded from local: ${localFilePath}`);

        return {
          success: true,
          buffer,
          contentType: this.getContentTypeFromExtension(key)
        };
      } catch (error) {
        this.logger.error('Local download failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return {
      success: false,
      error: 'No storage provider configured'
    };
  }

  async deleteFile(key: string): Promise<boolean> {
    let success = true;

    // Delete from S3 if configured
    if (this.isS3Configured() && process.env.STORAGE_PROVIDER !== 'local') {
      try {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key
        });

        await this.s3Client.send(command);
        this.logger.info(`Deleted from S3: ${key}`);
      } catch (error) {
        this.logger.error('S3 deletion failed:', error);
        success = false;
      }
    }

    // Delete from local storage
    if (this.useLocalFallback) {
      try {
        const localFilePath = this.getLocalPath(key);
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          this.logger.info(`Deleted local file: ${localFilePath}`);
        }
      } catch (error) {
        this.logger.error('Local deletion failed:', error);
        success = false;
      }
    }

    return success;
  }

  async listFiles(prefix: string = '', maxKeys: number = 1000): Promise<FileInfo[]> {
    // Try S3 first if configured
    if (this.isS3Configured() && process.env.STORAGE_PROVIDER !== 'local') {
      try {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: maxKeys
        });

        const response = await this.s3Client.send(command);

        return response.Contents?.map(obj => ({
          key: obj.Key || '',
          size: obj.Size || 0,
          lastModified: obj.LastModified || new Date(),
          contentType: 'unknown',
          etag: obj.ETag || ''
        })) || [];
      } catch (error) {
        this.logger.error('S3 list failed:', error);
        
        if (!this.useLocalFallback) {
          return [];
        }
      }
    }

    // List local files
    if (this.useLocalFallback) {
      try {
        const searchPath = path.join(this.localPath, prefix);
        const files: FileInfo[] = [];

        const walkDirectory = (dir: string, currentPrefix: string = '') => {
          if (!fs.existsSync(dir)) return;

          const items = fs.readdirSync(dir);
          
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            const relativePath = path.join(currentPrefix, item).replace(/\\/g, '/');

            if (stat.isFile()) {
              files.push({
                key: relativePath,
                size: stat.size,
                lastModified: stat.mtime,
                contentType: this.getContentTypeFromExtension(item),
                etag: `"${stat.mtime.getTime()}"`
              });
            } else if (stat.isDirectory()) {
              walkDirectory(fullPath, relativePath);
            }
          }
        };

        if (fs.existsSync(searchPath) && fs.statSync(searchPath).isDirectory()) {
          walkDirectory(searchPath);
        } else {
          walkDirectory(this.localPath, prefix);
        }

        return files.slice(0, maxKeys);
      } catch (error) {
        this.logger.error('Local list failed:', error);
        return [];
      }
    }

    return [];
  }

  async getFileInfo(key: string): Promise<FileInfo | null> {
    // Try S3 first if configured
    if (this.isS3Configured() && process.env.STORAGE_PROVIDER !== 'local') {
      try {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key
        });

        const response = await this.s3Client.send(command);

        return {
          key,
          size: response.ContentLength || 0,
          lastModified: response.LastModified || new Date(),
          contentType: response.ContentType || 'unknown',
          etag: response.ETag || ''
        };
      } catch (error) {
        this.logger.error('S3 file info failed:', error);
        
        if (!this.useLocalFallback) {
          return null;
        }
      }
    }

    // Try local storage
    if (this.useLocalFallback) {
      try {
        const localFilePath = this.getLocalPath(key);
        
        if (!fs.existsSync(localFilePath)) {
          return null;
        }

        const stat = fs.statSync(localFilePath);

        return {
          key,
          size: stat.size,
          lastModified: stat.mtime,
          contentType: this.getContentTypeFromExtension(key),
          etag: `"${stat.mtime.getTime()}"`
        };
      } catch (error) {
        this.logger.error('Local file info failed:', error);
        return null;
      }
    }

    return null;
  }

  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
    if (!this.isS3Configured() || process.env.STORAGE_PROVIDER === 'local') {
      // For local storage, return direct URL
      return `/uploads/${key}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error('Presigned URL generation failed:', error);
      return null;
    }
  }

  async getStorageStats(): Promise<StorageStats> {
    const files = await this.listFiles();
    
    const stats: StorageStats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      evidenceFiles: files.filter(file => file.key.includes('evidence')).length,
      tempFiles: files.filter(file => file.key.includes('temp')).length,
      oldestFile: null,
      newestFile: null
    };

    if (files.length > 0) {
      const sortedByDate = files.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
      stats.oldestFile = sortedByDate[0].lastModified;
      stats.newestFile = sortedByDate[sortedByDate.length - 1].lastModified;
    }

    return stats;
  }

  async cleanupExpiredFiles(): Promise<number> {
    const retentionDays = parseInt(process.env.EVIDENCE_RETENTION_DAYS || '90');
    const retentionHours = parseInt(process.env.TEMP_FILE_RETENTION_HOURS || '24');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const tempCutoffDate = new Date();
    tempCutoffDate.setHours(tempCutoffDate.getHours() - retentionHours);

    const files = await this.listFiles();
    let deletedCount = 0;

    for (const file of files) {
      let shouldDelete = false;

      if (file.key.includes('temp') && file.lastModified < tempCutoffDate) {
        shouldDelete = true;
      } else if (file.key.includes('evidence') && file.lastModified < cutoffDate) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        const deleted = await this.deleteFile(file.key);
        if (deleted) {
          deletedCount++;
          this.logger.info(`Deleted expired file: ${file.key}`);
        }
      }
    }

    this.logger.info(`Cleaned up ${deletedCount} expired files`);
    return deletedCount;
  }

  private getContentTypeFromExtension(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.avi': 'video/avi',
      '.mov': 'video/quicktime',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  isS3Configured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      this.bucket
    );
  }

  getStorageMode(): 'local' | 's3' | 'hybrid' {
    if (process.env.STORAGE_PROVIDER === 'local') return 'local';
    if (process.env.STORAGE_PROVIDER === 'hybrid') return 'hybrid';
    return this.isS3Configured() ? 's3' : 'local';
  }
}

export default new S3StorageService();