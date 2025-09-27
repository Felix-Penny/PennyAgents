import OpenAI from "openai";
import { resolveModel, DEFAULT_OPENAI_MODEL } from "./ai/openaiConfig";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface FaceDetection {
  id: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  features: {
    age?: string;
    gender?: string;
    emotion?: string;
    facialHair?: string;
    accessories?: string[];
  };
  embedding?: number[]; // For face matching
}

export interface VideoAnalysisResult {
  id: string;
  detectedFaces: FaceDetection[];
  matchedOffenders: Array<{
    offenderId: string;
    confidence: number;
    faceId: string;
    timestamp: number;
  }>;
  suspiciousActivity: Array<{
    type: string;
    confidence: number;
    timestamp: number;
    description: string;
  }>;
  videoMetadata: {
    duration: number;
    frameRate: number;
    resolution: string;
  };
}

export class VideoAnalysisService {
  private uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  /**
   * Extract frames from video at regular intervals for analysis using ffmpeg
   */
  async extractFrames(videoPath: string, intervalSeconds: number = 2): Promise<string[]> {
    const framePaths: string[] = [];
    const frameDir = path.join(this.uploadDir, 'frames');
    
    try {
      // Ensure frames directory exists
      await fs.mkdir(frameDir, { recursive: true });
      
      const videoId = randomUUID();
      const framePattern = path.join(frameDir, `${videoId}_frame_%03d.jpg`);
      
      // Use ffmpeg to extract frames at specified intervals
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vf "fps=1/${intervalSeconds}" -q:v 2 "${framePattern}"`;
      
      console.log('Extracting frames with command:', ffmpegCommand);
      await execAsync(ffmpegCommand);
      
      // Read extracted frame files
      const files = await fs.readdir(frameDir);
      const videoFrames = files
        .filter(file => file.startsWith(`${videoId}_frame_`) && file.endsWith('.jpg'))
        .sort()
        .map(file => path.join(frameDir, file));
      
      console.log(`Extracted ${videoFrames.length} frames from video`);
      return videoFrames;
      
    } catch (error) {
      console.error('Frame extraction failed:', error);
      // Fallback: return original video path (will need different handling)
      return [videoPath];
    }
  }

  /**
   * Convert image frame to base64 for OpenAI Vision API
   */
  private async frameToBase64(framePath: string): Promise<string> {
    try {
      const frameBuffer = await fs.readFile(framePath);
      return frameBuffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to read frame: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Crop face from frame using bounding box coordinates
   */
  async cropFaceFromFrame(framePath: string, boundingBox: {x: number, y: number, width: number, height: number}): Promise<string> {
    try {
      const faceId = randomUUID();
      const outputPath = path.join(this.uploadDir, 'faces', `face_${faceId}.jpg`);
      
      // Ensure faces directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Use ffmpeg to crop the face region
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const cropCommand = `ffmpeg -i "${framePath}" -vf "crop=${boundingBox.width}:${boundingBox.height}:${boundingBox.x}:${boundingBox.y}" -q:v 2 "${outputPath}"`;
      
      await execAsync(cropCommand);
      return outputPath;
      
    } catch (error) {
      console.error('Face cropping failed:', error);
      // Fallback: return original frame
      return framePath;
    }
  }

  /**
   * Analyze a single frame for faces and suspicious activity
   */
  async analyzeFrame(framePath: string, frameNumber: number): Promise<{
    faces: FaceDetection[];
    activities: Array<{ type: string; confidence: number; description: string; }>;
  }> {
    try {
      const base64Frame = await this.frameToBase64(framePath);

      const analysisPrompt = `
        Analyze this security camera frame for:
        1. Human faces - detect all visible faces with approximate positions and characteristics
        2. Suspicious activities - theft, concealment, unusual behavior
        3. Objects of interest - bags, containers, potential weapons

        Respond with JSON in this exact format:
        {
          "faces": [
            {
              "id": "face_1",
              "confidence": 0.95,
              "boundingBox": {"x": 100, "y": 50, "width": 80, "height": 100},
              "features": {
                "age": "20-30",
                "gender": "male",
                "emotion": "neutral",
                "facialHair": "none",
                "accessories": ["glasses"]
              }
            }
          ],
          "activities": [
            {
              "type": "suspicious_behavior",
              "confidence": 0.8,
              "description": "Person concealing item in bag"
            }
          ]
        }
      `;

      const response = await openai.chat.completions.create({
  model: resolveModel(DEFAULT_OPENAI_MODEL),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: analysisPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Frame}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Process faces
      const faces: FaceDetection[] = (analysis.faces || []).map((face: any, index: number) => ({
        id: face.id || `face_${frameNumber}_${index}`,
        confidence: face.confidence || 0.5,
        boundingBox: face.boundingBox || { x: 0, y: 0, width: 100, height: 100 },
        features: face.features || {}
      }));

      // Process activities
      const activities = analysis.activities || [];

      return { faces, activities };

    } catch (error) {
      console.error('Frame analysis failed:', error);
      return { faces: [], activities: [] };
    }
  }

  /**
   * Compare detected face with known offenders using OpenAI vision
   */
  async compareFaceWithOffenders(
    faceImagePath: string, 
    knownOffenders: Array<{ id: string; name: string; thumbnails: string[] }>
  ): Promise<Array<{ offenderId: string; confidence: number; }>> {
    const matches: Array<{ offenderId: string; confidence: number; }> = [];

    try {
      // Convert cropped face image to base64
      const faceBase64 = await this.frameToBase64(faceImagePath);

      for (const offender of knownOffenders) {
        if (offender.thumbnails.length === 0) continue;

        try {
          // Compare with first thumbnail (in production, compare with all)
          const comparisonPrompt = `
            Compare these two faces and determine if they are the same person.
            Consider facial structure, features, and overall appearance.
            Ignore differences in lighting, angle, or photo quality.
            Focus on permanent facial features like bone structure, eye shape, nose, mouth.
            
            Respond with JSON: {"match": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}
          `;

          const response = await openai.chat.completions.create({
            model: resolveModel(DEFAULT_OPENAI_MODEL),
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: comparisonPrompt
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${faceBase64}` }
                  },
                  {
                    type: "image_url", 
                    image_url: { url: `data:image/jpeg;base64,${offender.thumbnails[0]}` }
                  }
                ],
              },
            ],
            response_format: { type: "json_object" },
            max_tokens: 200,
          });

          const comparison = JSON.parse(response.choices[0].message.content || '{}');
          
          if (comparison.match && comparison.confidence > 0.7) {
            matches.push({
              offenderId: offender.id,
              confidence: comparison.confidence
            });
          }

        } catch (error) {
          console.error(`Face comparison failed for offender ${offender.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Failed to process face image for comparison:', error);
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze complete video for faces and suspicious activity
   */
  async analyzeVideo(
    videoPath: string, 
    storeId: string,
    cameraId?: string
  ): Promise<VideoAnalysisResult> {
    const analysisId = randomUUID();
    
    try {
      // Extract frames from video
      const frames = await this.extractFrames(videoPath, 2); // Every 2 seconds
      
      const allFaces: FaceDetection[] = [];
      const allActivities: Array<{
        type: string;
        confidence: number;
        timestamp: number;
        description: string;
      }> = [];

      // Analyze each frame
      for (let i = 0; i < frames.length; i++) {
        const frameAnalysis = await this.analyzeFrame(frames[i], i);
        
        // Add timestamp to faces
        frameAnalysis.faces.forEach(face => {
          face.id = `${face.id}_frame_${i}`;
          allFaces.push(face);
        });

        // Add timestamp to activities
        frameAnalysis.activities.forEach(activity => {
          allActivities.push({
            ...activity,
            timestamp: i * 2 // Assuming 2-second intervals
          });
        });
      }

      // TODO: Get known offenders from database and compare faces
      const matchedOffenders: Array<{
        offenderId: string;
        confidence: number;
        faceId: string;
        timestamp: number;
      }> = [];

      const result: VideoAnalysisResult = {
        id: analysisId,
        detectedFaces: allFaces,
        matchedOffenders,
        suspiciousActivity: allActivities,
        videoMetadata: {
          duration: frames.length * 2, // Estimated duration
          frameRate: 30, // Default assumption
          resolution: "1920x1080" // Default assumption
        }
      };

      return result;

    } catch (error) {
      console.error('Video analysis failed:', error);
      throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create video clip of specific time range
   */
  async createClip(
    videoPath: string,
    startTime: number,
    endTime: number,
    outputPath?: string
  ): Promise<string> {
    const clipId = randomUUID();
    const clipPath = outputPath || path.join(this.uploadDir, `clip_${clipId}.mp4`);

    try {
      // For MVP, we'll copy the original file as a "clip"
      // In production, use ffmpeg to extract the actual time range
      await fs.copyFile(videoPath, clipPath);
      
      console.log(`Created clip: ${clipPath} (${startTime}s - ${endTime}s)`);
      return clipPath;

    } catch (error) {
      throw new Error(`Failed to create video clip: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save uploaded video file
   */
  async saveUploadedVideo(fileBuffer: Buffer, originalName: string): Promise<string> {
    const fileExtension = path.extname(originalName);
    const fileName = `${randomUUID()}${fileExtension}`;
    const filePath = path.join(this.uploadDir, fileName);

    try {
      await fs.writeFile(filePath, fileBuffer);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save video file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const videoAnalysisService = new VideoAnalysisService();