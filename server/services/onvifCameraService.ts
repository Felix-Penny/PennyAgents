import winston from 'winston';
const onvif = require('node-onvif-ts');

interface CameraConfig {
  ip: string;
  port: number;
  username: string;
  password: string;
  name?: string;
  location?: string;
}

interface PTZPosition {
  pan: number;    // -1.0 to 1.0
  tilt: number;   // -1.0 to 1.0
  zoom: number;   // -1.0 to 1.0
}

interface PTZVector {
  pan: number;    // -1.0 to 1.0
  tilt: number;   // -1.0 to 1.0
  zoom: number;   // -1.0 to 1.0
}

interface CameraCapabilities {
  ptz: boolean;
  zoom: boolean;
  focus: boolean;
  iris: boolean;
  presets: boolean;
  patrols: boolean;
}

interface CameraPreset {
  token: string;
  name: string;
  position?: PTZPosition;
}

interface CameraInfo {
  manufacturer: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  hardwareId: string;
}

interface PTZResult {
  success: boolean;
  error?: string;
  position?: PTZPosition;
}

interface DiscoveredCamera {
  ip: string;
  port: number;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
}

class ONVIFCameraService {
  private cameras: Map<string, any>;
  private logger: winston.Logger;
  private discoveryTimeout: number;
  private commandTimeout: number;
  private defaultUsername: string;
  private defaultPassword: string;

  constructor() {
    this.cameras = new Map();
    this.discoveryTimeout = parseInt(process.env.ONVIF_DISCOVERY_TIMEOUT || '10000');
    this.commandTimeout = parseInt(process.env.ONVIF_COMMAND_TIMEOUT || '5000');
    this.defaultUsername = process.env.ONVIF_DEFAULT_USERNAME || 'admin';
    this.defaultPassword = process.env.ONVIF_DEFAULT_PASSWORD || 'admin';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/onvif.log' })
      ]
    });
  }

  async discoverCameras(): Promise<DiscoveredCamera[]> {
    try {
      this.logger.info('Starting ONVIF camera discovery...');

      const devices = await onvif.discovery({
        timeout: this.discoveryTimeout
      });

      const cameras: DiscoveredCamera[] = devices.map((device: any) => {
        const url = new URL(device.xaddr);
        return {
          ip: url.hostname,
          port: parseInt(url.port) || 80,
          manufacturer: device.manufacturer,
          model: device.model,
          serialNumber: device.serialNumber
        };
      });

      this.logger.info(`Discovered ${cameras.length} ONVIF cameras`);
      return cameras;

    } catch (error) {
      this.logger.error('Camera discovery failed:', error);
      return [];
    }
  }

  async connectCamera(config: CameraConfig): Promise<{ success: boolean; error?: string; cameraId?: string }> {
    try {
      const cameraId = `${config.ip}:${config.port}`;

      this.logger.info(`Connecting to camera: ${cameraId}`);

      const camera = new onvif.Cam({
        hostname: config.ip,
        port: config.port,
        username: config.username,
        password: config.password,
        timeout: this.commandTimeout
      });

      // Initialize camera connection
      await new Promise<void>((resolve, reject) => {
        camera.connect((error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.cameras.set(cameraId, camera);

      this.logger.info(`Successfully connected to camera: ${cameraId}`);

      return {
        success: true,
        cameraId
      };

    } catch (error) {
      this.logger.error('Camera connection failed:', {
        ip: config.ip,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  async disconnectCamera(cameraId: string): Promise<boolean> {
    try {
      const camera = this.cameras.get(cameraId);
      if (camera) {
        this.cameras.delete(cameraId);
        this.logger.info(`Disconnected camera: ${cameraId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Camera disconnection failed:', error);
      return false;
    }
  }

  async getCameraInfo(cameraId: string): Promise<CameraInfo | null> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        throw new Error('Camera not connected');
      }

      const deviceInfo = await new Promise<any>((resolve, reject) => {
        camera.getDeviceInformation((error: any, info: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(info);
          }
        });
      });

      return {
        manufacturer: deviceInfo.manufacturer || 'Unknown',
        model: deviceInfo.model || 'Unknown',
        firmwareVersion: deviceInfo.firmwareVersion || 'Unknown',
        serialNumber: deviceInfo.serialNumber || 'Unknown',
        hardwareId: deviceInfo.hardwareId || 'Unknown'
      };

    } catch (error) {
      this.logger.error('Failed to get camera info:', error);
      return null;
    }
  }

  async getCameraCapabilities(cameraId: string): Promise<CameraCapabilities | null> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        throw new Error('Camera not connected');
      }

      const capabilities = await new Promise<any>((resolve, reject) => {
        camera.getCapabilities((error: any, caps: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(caps);
          }
        });
      });

      const ptzCapabilities = capabilities.PTZ || {};

      return {
        ptz: !!ptzCapabilities,
        zoom: !!(ptzCapabilities && ptzCapabilities.ZoomLimits),
        focus: !!(ptzCapabilities && ptzCapabilities.Focus),
        iris: !!(ptzCapabilities && ptzCapabilities.Iris),
        presets: !!(ptzCapabilities && ptzCapabilities.PresetSupport),
        patrols: !!(ptzCapabilities && ptzCapabilities.PatrolSupport)
      };

    } catch (error) {
      this.logger.error('Failed to get camera capabilities:', error);
      return null;
    }
  }

  async movePTZ(cameraId: string, vector: PTZVector, speed?: number): Promise<PTZResult> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      await new Promise<void>((resolve, reject) => {
        camera.continuousMove({
          x: vector.pan,
          y: vector.tilt,
          zoom: vector.zoom
        }, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`PTZ move command sent to camera: ${cameraId}`, vector);

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('PTZ move failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Move failed'
      };
    }
  }

  async stopPTZ(cameraId: string): Promise<PTZResult> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      await new Promise<void>((resolve, reject) => {
        camera.stop(true, true, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`PTZ stop command sent to camera: ${cameraId}`);

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('PTZ stop failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stop failed'
      };
    }
  }

  async setPTZPosition(cameraId: string, position: PTZPosition): Promise<PTZResult> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      await new Promise<void>((resolve, reject) => {
        camera.absoluteMove({
          x: position.pan,
          y: position.tilt,
          zoom: position.zoom
        }, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`PTZ absolute move command sent to camera: ${cameraId}`, position);

      return {
        success: true,
        position
      };

    } catch (error) {
      this.logger.error('PTZ absolute move failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Absolute move failed'
      };
    }
  }

  async getPTZPosition(cameraId: string): Promise<PTZResult> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      const status = await new Promise<any>((resolve, reject) => {
        camera.getStatus((error: any, status: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(status);
          }
        });
      });

      const position = status.position;

      return {
        success: true,
        position: {
          pan: position.x || 0,
          tilt: position.y || 0,
          zoom: position.zoom || 0
        }
      };

    } catch (error) {
      this.logger.error('Get PTZ position failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get position failed'
      };
    }
  }

  async getPresets(cameraId: string): Promise<{ success: boolean; presets?: CameraPreset[]; error?: string }> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      const presets = await new Promise<any[]>((resolve, reject) => {
        camera.getPresets((error: any, presets: any[]) => {
          if (error) {
            reject(error);
          } else {
            resolve(presets || []);
          }
        });
      });

      const formattedPresets: CameraPreset[] = presets.map(preset => ({
        token: preset.token || preset.Token,
        name: preset.name || preset.Name || `Preset ${preset.token}`,
        position: preset.PTZPosition ? {
          pan: preset.PTZPosition.PanTilt?.x || 0,
          tilt: preset.PTZPosition.PanTilt?.y || 0,
          zoom: preset.PTZPosition.Zoom?.x || 0
        } : undefined
      }));

      return {
        success: true,
        presets: formattedPresets
      };

    } catch (error) {
      this.logger.error('Get presets failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Get presets failed'
      };
    }
  }

  async setPreset(cameraId: string, presetName: string): Promise<{ success: boolean; presetToken?: string; error?: string }> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      const result = await new Promise<any>((resolve, reject) => {
        camera.setPreset({
          presetName: presetName
        }, (error: any, result: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      this.logger.info(`Preset "${presetName}" set for camera: ${cameraId}`);

      return {
        success: true,
        presetToken: result.presetToken || result.PresetToken
      };

    } catch (error) {
      this.logger.error('Set preset failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Set preset failed'
      };
    }
  }

  async gotoPreset(cameraId: string, presetToken: string): Promise<PTZResult> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      await new Promise<void>((resolve, reject) => {
        camera.gotoPreset({
          preset: presetToken
        }, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`Goto preset ${presetToken} command sent to camera: ${cameraId}`);

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Goto preset failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Goto preset failed'
      };
    }
  }

  async removePreset(cameraId: string, presetToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      await new Promise<void>((resolve, reject) => {
        camera.removePreset({
          preset: presetToken
        }, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`Preset ${presetToken} removed from camera: ${cameraId}`);

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Remove preset failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Remove preset failed'
      };
    }
  }

  async startAutoPan(cameraId: string, speed: number = 0.5): Promise<PTZResult> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      // Start continuous pan movement
      await new Promise<void>((resolve, reject) => {
        camera.continuousMove({
          x: speed,  // Pan speed
          y: 0,      // No tilt
          zoom: 0    // No zoom
        }, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`Auto pan started for camera: ${cameraId} at speed: ${speed}`);

      return {
        success: true
      };

    } catch (error) {
      this.logger.error('Start auto pan failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Start auto pan failed'
      };
    }
  }

  async homePosition(cameraId: string): Promise<PTZResult> {
    try {
      const camera = this.cameras.get(cameraId);
      if (!camera) {
        return {
          success: false,
          error: 'Camera not connected'
        };
      }

      // Go to center position
      await new Promise<void>((resolve, reject) => {
        camera.absoluteMove({
          x: 0,      // Center pan
          y: 0,      // Center tilt  
          zoom: 0    // Default zoom
        }, (error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.info(`Home position command sent to camera: ${cameraId}`);

      return {
        success: true,
        position: { pan: 0, tilt: 0, zoom: 0 }
      };

    } catch (error) {
      this.logger.error('Home position failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Home position failed'
      };
    }
  }

  async getConnectedCameras(): Promise<string[]> {
    return Array.from(this.cameras.keys());
  }

  async testCameraConnection(config: CameraConfig): Promise<{ success: boolean; error?: string; info?: CameraInfo }> {
    try {
      const connection = await this.connectCamera(config);
      
      if (!connection.success || !connection.cameraId) {
        return {
          success: false,
          error: connection.error
        };
      }

      const info = await this.getCameraInfo(connection.cameraId);
      
      // Disconnect test connection
      await this.disconnectCamera(connection.cameraId);

      return {
        success: true,
        info: info || undefined
      };

    } catch (error) {
      this.logger.error('Camera connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  isConfigured(): boolean {
    return !!(this.defaultUsername && this.defaultPassword);
  }

  getConfiguration(): {
    discoveryTimeout: number;
    commandTimeout: number;
    connectedCameras: number;
    configured: boolean;
  } {
    return {
      discoveryTimeout: this.discoveryTimeout,
      commandTimeout: this.commandTimeout,
      connectedCameras: this.cameras.size,
      configured: this.isConfigured()
    };
  }
}

export default new ONVIFCameraService();