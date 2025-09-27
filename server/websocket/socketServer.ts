import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth';
import type { ExtendedError } from 'socket.io/dist/namespace';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    storeIds: string[];
  };
}

// Create Redis clients for Socket.IO adapter
const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subClient = pubClient.duplicate();

export function initializeWebSocket(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    adapter: createAdapter(pubClient, subClient)
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // You would typically fetch user details from database here
      socket.userId = decoded.userId;
      socket.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user',
        storeIds: decoded.storeIds || []
      };

      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection handling
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`✅ Client connected: ${socket.id} (User: ${socket.user?.email})`);
    
    // Join user to their personal room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }
    
    // Store subscription handling
    socket.on('join-store', async (data: { storeId: string }) => {
      const { storeId } = data;
      
      // Verify user has access to this store
      if (socket.user?.storeIds.includes(storeId) || socket.user?.role === 'admin') {
        await socket.join(`store:${storeId}`);
        socket.emit('joined-store', { storeId, success: true });
        console.log(`📍 User ${socket.user?.email} joined store: ${storeId}`);
      } else {
        socket.emit('error', { message: 'Access denied to store', storeId });
      }
    });
    
    socket.on('leave-store', async (data: { storeId: string }) => {
      const { storeId } = data;
      await socket.leave(`store:${storeId}`);
      socket.emit('left-store', { storeId, success: true });
    });

    // Camera stream subscription
    socket.on('subscribe-camera', async (data: { cameraId: string, storeId: string }) => {
      const { cameraId, storeId } = data;
      
      // Verify access to store first
      if (socket.user?.storeIds.includes(storeId) || socket.user?.role === 'admin') {
        await socket.join(`camera:${cameraId}`);
        socket.emit('subscribed-camera', { cameraId, success: true });
        console.log(`📹 User ${socket.user?.email} subscribed to camera: ${cameraId}`);
        
        // Send current camera status
        // This would typically fetch from database or Redis cache
        socket.emit('camera-status', {
          cameraId,
          status: 'active', // or get from database
          timestamp: new Date().toISOString()
        });
      } else {
        socket.emit('error', { message: 'Access denied to camera', cameraId });
      }
    });
    
    socket.on('unsubscribe-camera', async (data: { cameraId: string }) => {
      const { cameraId } = data;
      await socket.leave(`camera:${cameraId}`);
      socket.emit('unsubscribed-camera', { cameraId, success: true });
    });

    // Alert handling
    socket.on('acknowledge-alert', async (data: { alertId: string, notes?: string }) => {
      const { alertId, notes } = data;
      
      try {
        // Update alert in database (implement this)
        // await acknowledgeAlert(alertId, socket.userId!, notes);
        
        // Notify all users in the same stores about the acknowledgment
        socket.user?.storeIds.forEach(storeId => {
          socket.to(`store:${storeId}`).emit('alert-acknowledged', {
            alertId,
            acknowledgedBy: {
              id: socket.userId,
              email: socket.user?.email
            },
            notes,
            timestamp: new Date().toISOString()
          });
        });
        
        socket.emit('alert-acknowledged-success', { alertId });
        
      } catch (error) {
        console.error('Error acknowledging alert:', error);
        socket.emit('error', { message: 'Failed to acknowledge alert', alertId });
      }
    });

    // Stream control
    socket.on('start-stream-analysis', async (data: { cameraId: string }) => {
      const { cameraId } = data;
      
      try {
        // Call stream processing service to start analysis
        // This would interface with the AI service
        socket.emit('stream-analysis-started', { cameraId, success: true });
        console.log(`🎬 Started analysis for camera: ${cameraId}`);
      } catch (error) {
        console.error('Error starting stream analysis:', error);
        socket.emit('error', { message: 'Failed to start stream analysis', cameraId });
      }
    });
    
    socket.on('stop-stream-analysis', async (data: { cameraId: string }) => {
      const { cameraId } = data;
      
      try {
        // Call stream processing service to stop analysis
        socket.emit('stream-analysis-stopped', { cameraId, success: true });
        console.log(`⏹️ Stopped analysis for camera: ${cameraId}`);
      } catch (error) {
        console.error('Error stopping stream analysis:', error);
        socket.emit('error', { message: 'Failed to stop stream analysis', cameraId });
      }
    });

    // Health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Disconnection handling
    socket.on('disconnect', (reason) => {
      console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

// Utility functions to emit events from other parts of the application

export function emitToStore(io: Server, storeId: string, event: string, data: any) {
  io.to(`store:${storeId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

export function emitToCamera(io: Server, cameraId: string, event: string, data: any) {
  io.to(`camera:${cameraId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

export function emitToUser(io: Server, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
}

// Real-time event emitters
export function emitCameraFrame(io: Server, cameraId: string, frameData: any) {
  emitToCamera(io, cameraId, 'camera-frame', frameData);
}

export function emitAnalysisResult(io: Server, cameraId: string, analysis: any) {
  emitToCamera(io, cameraId, 'analysis-result', {
    cameraId,
    analysis
  });
}

export function emitAlert(io: Server, storeId: string, alertData: any) {
  emitToStore(io, storeId, 'new-alert', alertData);
}

export function emitIncident(io: Server, storeId: string, incidentData: any) {
  emitToStore(io, storeId, 'new-incident', incidentData);
}

export function emitCameraStatus(io: Server, cameraId: string, status: any) {
  emitToCamera(io, cameraId, 'camera-status', {
    cameraId,
    status
  });
}

export function emitStreamHealth(io: Server, cameraId: string, health: any) {
  emitToCamera(io, cameraId, 'stream-health', {
    cameraId,
    health
  });
}

// Error handling
export function emitError(io: Server, target: string, error: any) {
  io.to(target).emit('error', {
    message: error.message || 'An error occurred',
    code: error.code,
    timestamp: new Date().toISOString()
  });
}