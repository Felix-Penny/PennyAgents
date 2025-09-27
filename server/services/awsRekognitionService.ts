import { RekognitionClient, CreateCollectionCommand, IndexFacesCommand, SearchFacesByImageCommand, DetectFacesCommand, CompareFacesCommand, DeleteCollectionCommand, ListCollectionsCommand, DeleteFacesCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import winston from 'winston';

interface FaceDetectionResult {
  success: boolean;
  faces: Array<{
    confidence: number;
    boundingBox: {
      width: number;
      height: number;
      left: number;
      top: number;
    };
    landmarks: Array<{
      type: string;
      x: number;
      y: number;
    }>;
    quality: {
      brightness: number;
      sharpness: number;
    };
  }>;
  error?: string;
}

interface FaceSearchResult {
  success: boolean;
  matches: Array<{
    face: {
      faceId: string;
      confidence: number;
    };
    similarity: number;
  }>;
  unindexedFaces?: Array<{
    reasons: string[];
  }>;
  error?: string;
}

interface FaceIndexResult {
  success: boolean;
  faceRecords: Array<{
    face: {
      faceId: string;
      imageId: string;
      confidence: number;
    };
    faceDetail: {
      boundingBox: any;
      landmarks: any[];
      quality: {
        brightness: number;
        sharpness: number;
      };
    };
  }>;
  unindexedFaces?: Array<{
    reasons: string[];
  }>;
  error?: string;
}

class AWSRekognitionService {
  private rekognitionClient: RekognitionClient;
  private s3Client: S3Client;
  private collectionId: string;
  private minConfidence: number;
  private maxFaces: number;
  private logger: winston.Logger;

  constructor() {
    this.rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    this.collectionId = process.env.AWS_REKOGNITION_COLLECTION_ID || 'pennyprotect-faces';
    this.minConfidence = parseInt(process.env.AWS_REKOGNITION_MIN_CONFIDENCE || '80');
    this.maxFaces = parseInt(process.env.AWS_REKOGNITION_MAX_FACES || '100');

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/rekognition.log' })
      ]
    });

    this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    try {
      // Check if collection exists
      const listCommand = new ListCollectionsCommand({});
      const response = await this.rekognitionClient.send(listCommand);
      
      const collectionExists = response.CollectionIds?.includes(this.collectionId);
      
      if (!collectionExists) {
        // Create collection
        const createCommand = new CreateCollectionCommand({
          CollectionId: this.collectionId
        });
        
        await this.rekognitionClient.send(createCommand);
        this.logger.info(`Created Rekognition collection: ${this.collectionId}`);
      } else {
        this.logger.info(`Rekognition collection already exists: ${this.collectionId}`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize Rekognition collection:', error);
    }
  }

  async detectFaces(imageBuffer: Buffer): Promise<FaceDetectionResult> {
    try {
      const command = new DetectFacesCommand({
        Image: {
          Bytes: imageBuffer
        },
        Attributes: ['ALL']
      });

      const response = await this.rekognitionClient.send(command);

      const faces = response.FaceDetails?.map(face => ({
        confidence: face.Confidence || 0,
        boundingBox: {
          width: face.BoundingBox?.Width || 0,
          height: face.BoundingBox?.Height || 0,
          left: face.BoundingBox?.Left || 0,
          top: face.BoundingBox?.Top || 0
        },
        landmarks: face.Landmarks?.map(landmark => ({
          type: landmark.Type || '',
          x: landmark.X || 0,
          y: landmark.Y || 0
        })) || [],
        quality: {
          brightness: face.Quality?.Brightness || 0,
          sharpness: face.Quality?.Sharpness || 0
        }
      })) || [];

      this.logger.info(`Detected ${faces.length} faces in image`);

      return {
        success: true,
        faces
      };
    } catch (error) {
      this.logger.error('Face detection failed:', error);
      return {
        success: false,
        faces: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async indexFace(imageBuffer: Buffer, externalImageId: string): Promise<FaceIndexResult> {
    try {
      const command = new IndexFacesCommand({
        CollectionId: this.collectionId,
        Image: {
          Bytes: imageBuffer
        },
        ExternalImageId: externalImageId,
        MaxFaces: this.maxFaces,
        QualityFilter: 'AUTO',
        DetectionAttributes: ['ALL']
      });

      const response = await this.rekognitionClient.send(command);

      const faceRecords = response.FaceRecords?.map(record => ({
        face: {
          faceId: record.Face?.FaceId || '',
          imageId: record.Face?.ExternalImageId || '',
          confidence: record.Face?.Confidence || 0
        },
        faceDetail: {
          boundingBox: record.FaceDetail?.BoundingBox,
          landmarks: record.FaceDetail?.Landmarks || [],
          quality: {
            brightness: record.FaceDetail?.Quality?.Brightness || 0,
            sharpness: record.FaceDetail?.Quality?.Sharpness || 0
          }
        }
      })) || [];

      const unindexedFaces = response.UnindexedFaces?.map(face => ({
        reasons: face.Reasons || []
      }));

      this.logger.info(`Indexed ${faceRecords.length} faces for ${externalImageId}`);

      return {
        success: true,
        faceRecords,
        unindexedFaces
      };
    } catch (error) {
      this.logger.error('Face indexing failed:', error);
      return {
        success: false,
        faceRecords: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async searchFacesByImage(imageBuffer: Buffer): Promise<FaceSearchResult> {
    try {
      const command = new SearchFacesByImageCommand({
        CollectionId: this.collectionId,
        Image: {
          Bytes: imageBuffer
        },
        FaceMatchThreshold: this.minConfidence,
        MaxFaces: this.maxFaces
      });

      const response = await this.rekognitionClient.send(command);

      const matches = response.FaceMatches?.map(match => ({
        face: {
          faceId: match.Face?.FaceId || '',
          confidence: match.Face?.Confidence || 0
        },
        similarity: match.Similarity || 0
      })) || [];

      this.logger.info(`Found ${matches.length} face matches`);

      return {
        success: true,
        matches
      };
    } catch (error) {
      this.logger.error('Face search failed:', error);
      return {
        success: false,
        matches: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async compareFaces(sourceImageBuffer: Buffer, targetImageBuffer: Buffer): Promise<{
    success: boolean;
    similarity?: number;
    sourceImageFace?: any;
    targetImageFace?: any;
    error?: string;
  }> {
    try {
      const command = new CompareFacesCommand({
        SourceImage: {
          Bytes: sourceImageBuffer
        },
        TargetImage: {
          Bytes: targetImageBuffer
        },
        SimilarityThreshold: this.minConfidence
      });

      const response = await this.rekognitionClient.send(command);

      if (response.FaceMatches && response.FaceMatches.length > 0) {
        const match = response.FaceMatches[0];
        return {
          success: true,
          similarity: match.Similarity,
          sourceImageFace: response.SourceImageFace,
          targetImageFace: match.Face
        };
      }

      return {
        success: true,
        similarity: 0
      };
    } catch (error) {
      this.logger.error('Face comparison failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteFace(faceId: string): Promise<boolean> {
    try {
      const command = new DeleteFacesCommand({
        CollectionId: this.collectionId,
        FaceIds: [faceId]
      });

      await this.rekognitionClient.send(command);
      this.logger.info(`Deleted face: ${faceId}`);
      return true;
    } catch (error) {
      this.logger.error('Face deletion failed:', error);
      return false;
    }
  }

  async storeImageInS3(imageBuffer: Buffer, key: string): Promise<string | null> {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET || '',
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/jpeg'
      });

      await this.s3Client.send(command);
      const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      
      this.logger.info(`Stored image in S3: ${url}`);
      return url;
    } catch (error) {
      this.logger.error('S3 image storage failed:', error);
      return null;
    }
  }

  async getCollectionStats(): Promise<{
    collectionId: string;
    faceCount: number;
    creationTimestamp: Date | null;
  }> {
    try {
      const listCommand = new ListCollectionsCommand({});
      const response = await this.rekognitionClient.send(listCommand);
      
      const collection = response.CollectionIds?.find(id => id === this.collectionId);
      
      if (collection) {
        // Note: Getting exact face count requires additional API call
        // For now, returning collection existence info
        return {
          collectionId: this.collectionId,
          faceCount: 0, // Would need DescribeCollection API call
          creationTimestamp: null
        };
      }

      return {
        collectionId: this.collectionId,
        faceCount: 0,
        creationTimestamp: null
      };
    } catch (error) {
      this.logger.error('Failed to get collection stats:', error);
      return {
        collectionId: this.collectionId,
        faceCount: 0,
        creationTimestamp: null
      };
    }
  }

  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      this.collectionId
    );
  }
}

export default new AWSRekognitionService();