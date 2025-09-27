import winston from 'winston';
import s3StorageService from './s3StorageService';
import * as fs from 'fs';
import * as path from 'path';

interface StorageUploadResult {
  success: boolean;
  url?: string;
  localPath?: string;
  s3Key?: string;
  error?: string;
  fallbackUsed?: boolean;
}

interface StorageDownloadResult {
  success: boolean;
  buffer?: Buffer;
  contentType?: string;
  error?: string;
  source?: 'local' | 's3';
}

interface StorageDeleteResult {
  success: boolean;
  deletedFromLocal?: boolean;
  deletedFromS3?: boolean;
  error?: string;
}

interface StorageConfig {
  localPath: string;
  evidencePath: string;
  tempPath: string;
  maxLocalSize: number; // in bytes
  syncToS3: boolean;
  localRetentionDays: number;
  s3Enabled: boolean;
}

interface FileMetadata {
  originalName: string;
  size: number;
  contentType: string;
  uploadDate: Date;
  s3Synced: boolean;
  localPath?: string;
  s3Key?: string;
  category: 'evidence' | 'temp' | 'profile' | 'alert' | 'report';
  storeId?: number;
  cameraId?: string;
}

class HybridStorageService {
  private config: StorageConfig;
  private logger: winston.Logger;
  private fileMetadata: Map<string, FileMetadata>;
  private syncQueue: Set<string>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.config = {
      localPath: process.env.LOCAL_STORAGE_PATH || './uploads',
      evidencePath: process.env.LOCAL_EVIDENCE_PATH || './uploads/evidence',
      tempPath: process.env.LOCAL_TEMP_PATH || './uploads/temp',
      maxLocalSize: parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024,
      syncToS3: process.env.STORAGE_PROVIDER !== 'local',
      localRetentionDays: parseInt(process.env.EVIDENCE_RETENTION_DAYS || '90'),
      s3Enabled: s3StorageService.isS3Configured()
    };

    this.fileMetadata = new Map();
    this.syncQueue = new Set();
    this.cleanupInterval = null;

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/hybrid-storage.log' })
      ]
    });

    this.initializeStorage();
  }

  private initializeStorage(): void {
    try {
      // Ensure local directories exist
      this.ensureDirectories();

      // Start background sync if enabled
      if (this.config.syncToS3 && this.config.s3Enabled) {
        this.startBackgroundSync();
      }

      // Start cleanup routine
      this.startCleanupRoutine();

      this.logger.info('Hybrid storage service initialized', {
        localPath: this.config.localPath,
        s3Enabled: this.config.s3Enabled,
        syncEnabled: this.config.syncToS3
      });

    } catch (error) {
      this.logger.error('Failed to initialize storage service:', error);
    }
  }

  private ensureDirectories(): void {
    const directories = [
      this.config.localPath,
      this.config.evidencePath,
      this.config.tempPath,
      path.join(this.config.localPath, 'profiles'),
      path.join(this.config.localPath, 'alerts'),
      path.join(this.config.localPath, 'reports')
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.info(`Created directory: ${dir}`);
      }
    });
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    options: {
      category?: 'evidence' | 'temp' | 'profile' | 'alert' | 'report';
      storeId?: number;
      cameraId?: string;
      contentType?: string;
      forceLocal?: boolean;
    } = {}
  ): Promise<StorageUploadResult> {
    try {
      const fileId = this.generateFileId();
      const category = options.category || 'evidence';
      const contentType = options.contentType || 'application/octet-stream';
      
      // Generate paths
      const s3Key = this.generateS3Key(category, fileId, filename);
      const localPath = this.generateLocalPath(category, fileId, filename);

      // Store metadata
      const metadata: FileMetadata = {
        originalName: filename,
        size: buffer.length,
        contentType,
        uploadDate: new Date(),
        s3Synced: false,
        localPath,
        s3Key,
        category,
        storeId: options.storeId,
        cameraId: options.cameraId
      };

      this.fileMetadata.set(fileId, metadata);

      let result: StorageUploadResult = { success: false };

      // Try S3 first if enabled and not forced local
      if (this.config.s3Enabled && this.config.syncToS3 && !options.forceLocal) {
        try {
          const s3Result = await s3StorageService.uploadFile(buffer, s3Key, contentType);
          
          if (s3Result.success) {
            metadata.s3Synced = true;
            result = {
              success: true,
              url: s3Result.url,
              s3Key,
              localPath
            };

            this.logger.info('File uploaded to S3', { fileId, s3Key, size: buffer.length });
          }
        } catch (error) {
          this.logger.warn('S3 upload failed, falling back to local:', error);
        }
      }

      // Store locally (always, for hybrid approach or as fallback)
      try {
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(localPath, buffer);
        
        if (!result.success) {
          result = {
            success: true,
            url: `/uploads/${path.relative(this.config.localPath, localPath)}`,
            localPath,
            fallbackUsed: this.config.s3Enabled && this.config.syncToS3
          };
        }

        // Queue for S3 sync if not already synced
        if (this.config.syncToS3 && this.config.s3Enabled && !metadata.s3Synced) {
          this.syncQueue.add(fileId);
        }

        this.logger.info('File stored locally', { fileId, localPath, size: buffer.length });

      } catch (error) {
        this.logger.error('Local storage failed:', error);
        this.fileMetadata.delete(fileId);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Local storage failed'
        };
      }

      return result;

    } catch (error) {
      this.logger.error('File upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async downloadFile(fileId: string): Promise<StorageDownloadResult> {
    try {
      const metadata = this.fileMetadata.get(fileId);
      if (!metadata) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      // Try local first (faster access)
      if (metadata.localPath && fs.existsSync(metadata.localPath)) {
        try {
          const buffer = fs.readFileSync(metadata.localPath);
          
          this.logger.info('File downloaded from local storage', { fileId });
          
          return {
            success: true,
            buffer,
            contentType: metadata.contentType,
            source: 'local'
          };
        } catch (error) {
          this.logger.warn('Local file read failed, trying S3:', error);
        }
      }

      // Try S3 if local failed or doesn't exist
      if (metadata.s3Synced && metadata.s3Key && this.config.s3Enabled) {
        try {
          const s3Result = await s3StorageService.downloadFile(metadata.s3Key);
          
          if (s3Result.success && s3Result.buffer) {
            // Restore to local cache if successful
            if (metadata.localPath) {
              try {
                const dir = path.dirname(metadata.localPath);
                if (!fs.existsSync(dir)) {
                  fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(metadata.localPath, s3Result.buffer);
              } catch (error) {
                this.logger.warn('Failed to cache S3 file locally:', error);
              }
            }

            this.logger.info('File downloaded from S3', { fileId });

            return {
              success: true,
              buffer: s3Result.buffer,
              contentType: s3Result.contentType || metadata.contentType,
              source: 's3'
            };
          }
        } catch (error) {
          this.logger.error('S3 download failed:', error);
        }
      }

      return {
        success: false,
        error: 'File not accessible from any storage location'
      };

    } catch (error) {
      this.logger.error('File download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  async deleteFile(fileId: string): Promise<StorageDeleteResult> {
    try {
      const metadata = this.fileMetadata.get(fileId);
      if (!metadata) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      let deletedFromLocal = false;
      let deletedFromS3 = false;

      // Delete from local storage
      if (metadata.localPath && fs.existsSync(metadata.localPath)) {
        try {
          fs.unlinkSync(metadata.localPath);
          deletedFromLocal = true;
          this.logger.info('File deleted from local storage', { fileId });
        } catch (error) {
          this.logger.error('Local file deletion failed:', error);
        }
      }

      // Delete from S3
      if (metadata.s3Key && this.config.s3Enabled) {
        try {
          const s3Success = await s3StorageService.deleteFile(metadata.s3Key);
          deletedFromS3 = s3Success;
          
          if (s3Success) {
            this.logger.info('File deleted from S3', { fileId });
          }
        } catch (error) {
          this.logger.error('S3 file deletion failed:', error);
        }
      }

      // Remove metadata
      this.fileMetadata.delete(fileId);
      this.syncQueue.delete(fileId);

      return {
        success: deletedFromLocal || deletedFromS3,
        deletedFromLocal,
        deletedFromS3
      };

    } catch (error) {
      this.logger.error('File deletion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deletion failed'
      };
    }
  }

  async syncFile(fileId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = this.fileMetadata.get(fileId);
      if (!metadata) {
        return { success: false, error: 'File not found' };
      }

      if (metadata.s3Synced) {
        return { success: true };
      }

      if (!metadata.localPath || !fs.existsSync(metadata.localPath)) {
        return { success: false, error: 'Local file not found' };
      }

      const buffer = fs.readFileSync(metadata.localPath);
      const s3Result = await s3StorageService.uploadFile(buffer, metadata.s3Key!, metadata.contentType);

      if (s3Result.success) {
        metadata.s3Synced = true;
        this.syncQueue.delete(fileId);
        
        this.logger.info('File synced to S3', { fileId, s3Key: metadata.s3Key });
        
        return { success: true };
      } else {
        return { success: false, error: s3Result.error };
      }

    } catch (error) {
      this.logger.error('File sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    return this.fileMetadata.get(fileId) || null;
  }

  async listFiles(category?: string, storeId?: number): Promise<Array<{ fileId: string; metadata: FileMetadata }>> {
    const files: Array<{ fileId: string; metadata: FileMetadata }> = [];

    Array.from(this.fileMetadata.entries()).forEach(([fileId, metadata]) => {
      if (category && metadata.category !== category) return;
      if (storeId && metadata.storeId !== storeId) return;
      
      files.push({ fileId, metadata });
    });

    return files;
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    localFiles: number;
    s3SyncedFiles: number;
    pendingSyncFiles: number;
    storageByCategory: Record<string, { count: number; size: number }>;
  }> {
    let totalFiles = 0;
    let totalSize = 0;
    let localFiles = 0;
    let s3SyncedFiles = 0;
    const storageByCategory: Record<string, { count: number; size: number }> = {};

    Array.from(this.fileMetadata.values()).forEach(metadata => {
      totalFiles++;
      totalSize += metadata.size;

      if (metadata.localPath && fs.existsSync(metadata.localPath)) {
        localFiles++;
      }

      if (metadata.s3Synced) {
        s3SyncedFiles++;
      }

      if (!storageByCategory[metadata.category]) {
        storageByCategory[metadata.category] = { count: 0, size: 0 };
      }
      storageByCategory[metadata.category].count++;
      storageByCategory[metadata.category].size += metadata.size;
    });

    return {
      totalFiles,
      totalSize,
      localFiles,
      s3SyncedFiles,
      pendingSyncFiles: this.syncQueue.size,
      storageByCategory
    };
  }

  private startBackgroundSync(): void {
    setInterval(async () => {
      if (this.syncQueue.size === 0) return;

      const fileIds = Array.from(this.syncQueue).slice(0, 5); // Process 5 at a time
      
      for (const fileId of fileIds) {
        try {
          await this.syncFile(fileId);
        } catch (error) {
          this.logger.error('Background sync failed for file:', { fileId, error });
        }
      }
    }, 30000); // Every 30 seconds
  }

  private startCleanupRoutine(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredFiles();
      } catch (error) {
        this.logger.error('Cleanup routine failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private async cleanupExpiredFiles(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.localRetentionDays);

    let deletedCount = 0;

    Array.from(this.fileMetadata.entries()).forEach(([fileId, metadata]) => {
      if (metadata.uploadDate < cutoffDate && metadata.s3Synced) {
        // Only delete local files that are synced to S3
        if (metadata.localPath && fs.existsSync(metadata.localPath)) {
          try {
            fs.unlinkSync(metadata.localPath);
            metadata.localPath = undefined; // Keep metadata but remove local reference
            deletedCount++;
            this.logger.info('Cleaned up expired local file', { fileId });
          } catch (error) {
            this.logger.error('Failed to cleanup expired file:', { fileId, error });
          }
        }
      }
    });

    this.logger.info(`Cleaned up ${deletedCount} expired local files`);
    return deletedCount;
  }

  private generateFileId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateS3Key(category: string, fileId: string, filename: string): string {
    const extension = path.extname(filename);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${category}/${year}/${month}/${day}/${fileId}${extension}`;
  }

  private generateLocalPath(category: string, fileId: string, filename: string): string {
    const extension = path.extname(filename);
    const categoryPath = category === 'evidence' ? this.config.evidencePath :
                        category === 'temp' ? this.config.tempPath :
                        path.join(this.config.localPath, category);
    
    return path.join(categoryPath, `${fileId}${extension}`);
  }

  getConfiguration(): {
    localPath: string;
    s3Enabled: boolean;
    syncEnabled: boolean;
    maxFileSize: number;
    retentionDays: number;
    totalFiles: number;
    pendingSync: number;
  } {
    return {
      localPath: this.config.localPath,
      s3Enabled: this.config.s3Enabled,
      syncEnabled: this.config.syncToS3,
      maxFileSize: this.config.maxLocalSize,
      retentionDays: this.config.localRetentionDays,
      totalFiles: this.fileMetadata.size,
      pendingSync: this.syncQueue.size
    };
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.logger.info('Hybrid storage service shutdown');
  }
}

export default new HybridStorageService();