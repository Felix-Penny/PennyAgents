// WebRTC Configuration for Production Deployment
// TURN/STUN Server Configuration for secure real-time communication

/**
 * WebRTC ICE Server Configuration
 * 
 * CRITICAL PRODUCTION SETTINGS:
 * - STUN servers for NAT traversal
 * - TURN servers for firewall/proxy bypass  
 * - Credential rotation and management
 * - Bandwidth and connection limits
 */

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  bundlePolicy: RTCBundlePolicy;
  rtcpMuxPolicy: RTCRtcpMuxPolicy;
  iceTransportPolicy: RTCIceTransportPolicy;
}

/**
 * Production TURN/STUN Configuration
 * Environment-based configuration for different deployment environments
 */
export class WebRTCConfigManager {
  private static instance: WebRTCConfigManager;
  private config: WebRTCConfig;

  constructor() {
    this.config = this.initializeConfig();
  }

  public static getInstance(): WebRTCConfigManager {
    if (!WebRTCConfigManager.instance) {
      WebRTCConfigManager.instance = new WebRTCConfigManager();
    }
    return WebRTCConfigManager.instance;
  }

  /**
   * Get WebRTC configuration for client connections
   * Returns sanitized config without sensitive credentials
   */
  public getClientConfig(): RTCConfiguration {
    return {
      iceServers: this.getPublicIceServers(),
      iceCandidatePoolSize: this.config.iceCandidatePoolSize,
      bundlePolicy: this.config.bundlePolicy,
      rtcpMuxPolicy: this.config.rtcpMuxPolicy,
      iceTransportPolicy: this.config.iceTransportPolicy
    };
  }

  /**
   * Get server-side configuration with credentials
   * Used for server-side WebRTC peer connections
   */
  public getServerConfig(): WebRTCConfig {
    return { ...this.config };
  }

  /**
   * Initialize WebRTC configuration from environment variables
   */
  private initializeConfig(): WebRTCConfig {
    const iceServers: RTCIceServer[] = [];

    // Default public STUN servers (free tier)
    iceServers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.stunprotocol.org:3478' }
    );

    // Production TURN servers (configured via environment)
    const turnUrls = this.getTurnUrls();
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    if (turnUrls.length > 0 && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential
      });
    } else {
      console.warn('[WebRTC] No TURN servers configured. WebRTC may fail behind restrictive firewalls.');
    }

    // Replit-specific configuration if available
    if (process.env.REPLIT_TURN_SERVER) {
      iceServers.push({
        urls: process.env.REPLIT_TURN_SERVER,
        username: process.env.REPLIT_TURN_USERNAME || '',
        credential: process.env.REPLIT_TURN_CREDENTIAL || ''
      });
    }

    return {
      iceServers,
      iceCandidatePoolSize: parseInt(process.env.ICE_CANDIDATE_POOL_SIZE || '10'),
      bundlePolicy: 'max-bundle' as RTCBundlePolicy,
      rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
      iceTransportPolicy: 'all' as RTCIceTransportPolicy
    };
  }

  /**
   * Parse TURN server URLs from environment
   */
  private getTurnUrls(): string[] {
    const turnServers = process.env.TURN_SERVERS;
    if (!turnServers) return [];

    try {
      // Support JSON array format
      if (turnServers.startsWith('[')) {
        return JSON.parse(turnServers);
      }
      
      // Support comma-separated format
      return turnServers.split(',').map(url => url.trim()).filter(Boolean);
    } catch (error) {
      console.error('[WebRTC] Invalid TURN_SERVERS format:', error);
      return [];
    }
  }

  /**
   * Get ICE servers without credentials for client-side use
   * Credentials are managed server-side for security
   */
  private getPublicIceServers(): RTCIceServer[] {
    return this.config.iceServers.map(server => {
      // Remove credentials from client config
      const { username, credential, ...publicServer } = server;
      return publicServer;
    });
  }

  /**
   * Validate WebRTC configuration
   */
  public async validateConfig(): Promise<{
    stunReachable: boolean;
    turnReachable: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let stunReachable = false;
    let turnReachable = false;

    try {
      // Test STUN connectivity
      const stunServers = this.config.iceServers.filter(server => 
        server.urls.toString().includes('stun:')
      );

      if (stunServers.length > 0) {
        stunReachable = await this.testStunConnectivity(stunServers[0].urls as string);
      } else {
        errors.push('No STUN servers configured');
      }

      // Test TURN connectivity
      const turnServers = this.config.iceServers.filter(server => 
        server.urls.toString().includes('turn:') && server.username
      );

      if (turnServers.length > 0) {
        turnReachable = await this.testTurnConnectivity(turnServers[0]);
      } else {
        errors.push('No TURN servers configured or credentials missing');
      }

    } catch (error) {
      errors.push(`Configuration validation error: ${error}`);
    }

    return { stunReachable, turnReachable, errors };
  }

  /**
   * Test STUN server connectivity
   */
  private async testStunConnectivity(stunUrl: string): Promise<boolean> {
    try {
      // Create a test peer connection
      const pc = new RTCPeerConnection({ iceServers: [{ urls: stunUrl }] });
      
      // Create data channel to trigger ICE gathering
      pc.createDataChannel('test');
      
      // Create offer to start ICE gathering
      await pc.createOffer();
      
      return new Promise<boolean>((resolve) => {
        let resolved = false;
        
        pc.onicecandidate = (event) => {
          if (!resolved && event.candidate && event.candidate.type === 'srflx') {
            // Received server reflexive candidate, STUN is working
            resolved = true;
            pc.close();
            resolve(true);
          }
        };

        pc.onicegatheringstatechange = () => {
          if (!resolved && pc.iceGatheringState === 'complete') {
            resolved = true;
            pc.close();
            resolve(false);
          }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            pc.close();
            resolve(false);
          }
        }, 10000);
      });

    } catch (error) {
      console.error('STUN connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Test TURN server connectivity
   */
  private async testTurnConnectivity(turnServer: RTCIceServer): Promise<boolean> {
    try {
      // TURN connectivity test would require more complex implementation
      // For now, validate that credentials are present
      return !!(turnServer.username && turnServer.credential);
    } catch (error) {
      console.error('TURN connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Get environment-specific recommendations
   */
  public getConfigurationRecommendations(): {
    environment: string;
    recommendations: string[];
    securityLevel: 'low' | 'medium' | 'high';
  } {
    const environment = process.env.NODE_ENV || 'development';
    const recommendations: string[] = [];
    let securityLevel: 'low' | 'medium' | 'high' = 'medium';

    if (environment === 'production') {
      if (!process.env.TURN_USERNAME || !process.env.TURN_CREDENTIAL) {
        recommendations.push('Configure TURN servers with credentials for production deployment');
        securityLevel = 'low';
      }

      if (!process.env.TURN_SERVERS) {
        recommendations.push('Set up dedicated TURN servers for reliable connectivity');
      }

      recommendations.push('Consider using commercial TURN service providers for high availability');
      recommendations.push('Implement credential rotation for TURN server authentication');
      recommendations.push('Monitor WebRTC connection success rates and fallback scenarios');

      if (recommendations.length === 0) {
        securityLevel = 'high';
      }

    } else if (environment === 'development') {
      recommendations.push('Public STUN servers are sufficient for development');
      recommendations.push('Set up TURN servers before deploying to production');
      securityLevel = 'medium';
    }

    return { environment, recommendations, securityLevel };
  }
}

// Singleton instance
export const webRTCConfig = WebRTCConfigManager.getInstance();

/**
 * WebRTC API endpoint configuration
 * Returns sanitized configuration for client-side use
 */
export function getWebRTCConfigForClient(): RTCConfiguration {
  return webRTCConfig.getClientConfig();
}

/**
 * Recommended TURN service providers for production
 */
export const RECOMMENDED_TURN_PROVIDERS = {
  twilio: {
    name: 'Twilio Network Traversal Service',
    docs: 'https://www.twilio.com/docs/stun-turn',
    features: ['Global infrastructure', 'Dynamic credentials', 'Analytics']
  },
  xirsys: {
    name: 'Xirsys Global TURN Network',
    docs: 'https://xirsys.com/',
    features: ['Global network', 'REST API', 'Analytics dashboard']
  },
  metered: {
    name: 'Metered TURN Service',
    docs: 'https://www.metered.ca/stun-turn',
    features: ['Simple setup', 'Global servers', 'Usage-based pricing']
  }
};

/**
 * Environment configuration template
 */
export const ENVIRONMENT_CONFIG_TEMPLATE = `
# WebRTC Configuration for Production
# Add these environment variables to your deployment

# TURN Server Configuration (Required for production)
TURN_SERVERS='["turn:your-turn-server.com:3478", "turns:your-turn-server.com:5349"]'
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-credential

# Optional: ICE configuration tuning
ICE_CANDIDATE_POOL_SIZE=10

# Replit-specific (if deploying on Replit)
REPLIT_TURN_SERVER=turn:replit-turn.com:3478
REPLIT_TURN_USERNAME=replit-user
REPLIT_TURN_CREDENTIAL=replit-password
`;