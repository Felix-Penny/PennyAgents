# PennyProtect MVP: A Developer's Guide to Implementation

**Objective**: This guide provides a comprehensive, step-by-step plan for building the PennyProtect Minimum Viable Product (MVP). It is designed for a development team to follow, covering everything from infrastructure setup to frontend implementation.

**Project Duration**: 4-6 weeks
**Team Allocation**: 1 Backend, 1 Frontend, 1 AI/ML, 1 DevOps

---

## Table of Contents
1.  [**Phase 1: Infrastructure & Core Services (Week 1)**](#phase-1-infrastructure--core-services-week-1)
    *   [1.1: Environment Setup with Docker](#11-environment-setup-with-docker)
    *   [1.2: Database Migration & Schema Extension](#12-database-migration--schema-extension)
    *   [1.3: Real-time WebSocket Server](#13-real-time-websocket-server)
2.  [**Phase 2: AI Integration & Analysis (Weeks 2-3)**](#phase-2-ai-integration--analysis-weeks-2-3)
    *   [2.1: Complete Facial Recognition](#21-complete-facial-recognition)
    *   [2.2: Implement Gait Detection](#22-implement-gait-detection)
    *   [2.3: Enhance Behavior Analysis](#23-enhance-behavior-analysis)
3.  [**Phase 3: Camera Integration & Streaming (Weeks 3-4)**](#phase-3-camera-integration--streaming-weeks-3-4)
    *   [3.1: RTSP Stream Ingestion](#31-rtsp-stream-ingestion)
    *   [3.2: Stream Processing Pipeline](#32-stream-processing-pipeline)
4.  [**Phase 4: Frontend & User Experience (Weeks 4-5)**](#phase-4-frontend--user-experience-weeks-4-5)
    *   [4.1: Build Core UI Components](#41-build-core-ui-components)
    *   [4.2: Implement Interactive Dashboard](#42-implement-interactive-dashboard)
5.  [**Phase 5: Testing, Deployment, & Documentation (Weeks 5-6)**](#phase-5-testing-deployment--documentation-weeks-5-6)
    *   [5.1: API and End-to-End Testing](#51-api-and-end-to-end-testing)
    *   [5.2: Deployment to Staging & Production](#52-deployment-to-staging--production)

---

## Phase 1: Infrastructure & Core Services (Week 1)

### 1.1: Environment Setup with Docker

**Goal**: Containerize all services for consistent development and deployment.

1.  **Create `docker-compose.yml`**:
    Define services for `postgres`, `redis`, `backend`, `ai-service`, and `frontend`.

    ```yaml
    # filepath: docker-compose.yml
    version: '3.8'

    services:
      postgres:
        image: postgres:14-alpine
        environment:
          POSTGRES_DB: pennyprotect
          POSTGRES_USER: ${DB_USER}
          POSTGRES_PASSWORD: ${DB_PASSWORD}
        volumes:
          - postgres_data:/var/lib/postgresql/data
        ports:
          - "5432:5432"

      redis:
        image: redis:7-alpine
        ports:
          - "6379:6379"

      backend:
        build: ./server
        depends_on:
          - postgres
          - redis
        environment:
          - NODE_ENV=${NODE_ENV}
          - DATABASE_URL=${DATABASE_URL}
          - REDIS_URL=redis://redis:6379
          - JWT_SECRET=${JWT_SECRET}
        ports:
          - "8000:8000"
        volumes:
          - ./server:/app
          - /app/node_modules

      ai-service:
        build: ./ai-service
        depends_on:
          - redis
        environment:
          - REDIS_URL=redis://redis:6379
          - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
          - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
          - OPENAI_API_KEY=${OPENAI_API_KEY}
        ports:
          - "8001:8001"
        volumes:
          - ./ai-service:/app
          - ./models:/app/models
        deploy:
          resources:
            reservations:
              devices:
                - capabilities: [gpu]

      frontend:
        build: ./client
        depends_on:
          - backend
        environment:
          - VITE_API_URL=http://localhost:8000
          - VITE_WS_URL=ws://localhost:8000
        ports:
          - "3000:3000"
        volumes:
          - ./client:/app
          - /app/node_modules

    volumes:
      postgres_data:
    ```

2.  **Create `.env.example`**:
    Provide a template for all required environment variables.

    ```bash
    # filepath: .env.example
    # Database
    DATABASE_URL=postgresql://user:password@localhost:5432/pennyprotect
    DB_USER=pennyprotect
    DB_PASSWORD=secure_password

    # Security
    JWT_SECRET=your-256-bit-secret

    # AWS & AI Services
    AWS_ACCESS_KEY_ID=your-access-key
    AWS_SECRET_ACCESS_KEY=your-secret-key
    AWS_REGION=us-east-1
    AWS_S3_BUCKET=pennyprotect-evidence
    OPENAI_API_KEY=sk-your-openai-key

    # Communication
    TWILIO_ACCOUNT_SID=your-sid
    TWILIO_AUTH_TOKEN=your-token
    TWILIO_PHONE_NUMBER=+1234567890
    ```

### 1.2: Database Migration & Schema Extension

**Goal**: Extend the database schema to support new AI features and run migrations.

1.  **Update `shared/schema.ts`**:
    Add tables for `gaitProfiles`, `streamSessions`, and `evidence`.

    ```typescript
    // filepath: shared/schema.ts

    // ... existing schema ...

    // Gait profiles for ML matching
    export const gaitProfiles = pgTable('gait_profiles', {
      id: uuid('id').primaryKey().defaultRandom(),
      personId: uuid('person_id').references(() => persons.id),
      features: jsonb('features').notNull(), // Stride, speed, rhythm
      embeddings: vector('embeddings', 128), // pgvector for similarity search
      createdAt: timestamp('created_at').defaultNow().notNull(),
    });

    // Monitoring for active camera streams
    export const streamSessions = pgTable('stream_sessions', {
      id: uuid('id').primaryKey().defaultRandom(),
      cameraId: uuid('camera_id').references(() => cameras.id).notNull(),
      status: varchar('status', 50).notNull(), // e.g., 'active', 'error'
      startedAt: timestamp('started_at').defaultNow().notNull(),
      endedAt: timestamp('ended_at'),
    });

    // S3 references for stored evidence
    export const evidence = pgTable('evidence', {
      id: uuid('id').primaryKey().defaultRandom(),
      incidentId: uuid('incident_id').references(() => incidents.id),
      type: varchar('type', 50).notNull(), // 'video', 'image'
      s3Key: varchar('s3_key', 500).notNull(),
      createdAt: timestamp('created_at').defaultNow().notNull(),
    });
    ```

2.  **Create and Run Migration**:
    Use `drizzle-kit` to generate and apply the new migration.

    ```bash
    npx drizzle-kit generate:pg --schema shared/schema.ts
    # Review the generated SQL file in migrations/
    npm run migrate # Assuming a script that runs drizzle-kit push:pg
    ```

### 1.3: Real-time WebSocket Server

**Goal**: Implement a WebSocket server for real-time communication between the backend and clients.

1.  **Integrate `socket.io`**:
    Create a service to initialize the server, handle authentication, and manage rooms.

    ```typescript
    // filepath: server/websocket/socketServer.ts
    import { Server } from 'socket.io';
    import { authenticateSocket } from './socketAuth'; // You need to implement this

    export function initializeWebSocket(httpServer) {
      const io = new Server(httpServer, {
        cors: { origin: process.env.CLIENT_URL, credentials: true },
      });

      io.use(authenticateSocket);

      io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on('join-store', (storeId) => {
          socket.join(`store:${storeId}`);
        });

        socket.on('subscribe-camera', (cameraId) => {
          socket.join(`camera:${cameraId}`);
        });
      });

      return io;
    }

    // Function to emit analysis results
    export function emitAnalysisResult(io, cameraId, analysis) {
      io.to(`camera:${cameraId}`).emit('analysis-result', {
        cameraId,
        timestamp: new Date(),
        analysis,
      });
    }
    ```

---

## Phase 2: AI Integration & Analysis (Weeks 2-3)

### 2.1: Complete Facial Recognition

**Goal**: Connect the existing facial recognition logic to the database for watchlist matching.

1.  **Create `facial_recognition.py` in `ai-service`**:
    Implement a service to load a watchlist, match faces, and store results.

    ```python
    # filepath: ai-service/facial_recognition.py
    import face_recognition
    import numpy as np
    # Assume db connection and models are available

    class FacialRecognitionService:
        def __init__(self):
            self.watchlist_cache = {} # Cache for known face encodings

        async def load_watchlist(self):
            # Load known faces from the 'persons' and 'facial_profiles' tables
            # into self.watchlist_cache
            pass

        async def process_face(self, image: np.ndarray):
            face_locations = face_recognition.face_locations(image, model='cnn')
            face_encodings = face_recognition.face_encodings(image, face_locations)

            results = []
            for encoding in face_encodings:
                matches = face_recognition.compare_faces(
                    list(self.watchlist_cache.values()), encoding
                )
                # Find the best match and return person ID, confidence, etc.
                # ... matching logic ...
                results.append(match_result)
            return results
    ```

### 2.2: Implement Gait Detection

**Goal**: Build a new service to analyze walking patterns from video sequences.

1.  **Create `gait_detection.py` in `ai-service`**:
    Use YOLO for pose estimation and analyze the sequence of keypoints.

    ```python
    # filepath: ai-service/gait_detection.py
    import numpy as np
    from ultralytics import YOLO

    class GaitDetectionService:
        def __init__(self):
            self.pose_model = YOLO('yolov8n-pose.pt')

        def analyze_gait_sequence(self, frames: list):
            keypoints_sequence = []
            for frame in frames:
                results = self.pose_model(frame)
                if results[0].keypoints:
                    keypoints_sequence.append(results[0].keypoints.data.numpy())

            if len(keypoints_sequence) < 30: # Need enough frames
                return {}

            # Calculate features: stride length, speed, body sway, etc.
            # ... feature extraction logic ...

            # Compare features to known profiles in 'gait_profiles' table
            # ... matching logic ...

            return {'gait_features': features, 'match': match_result}
    ```

### 2.3: Enhance Behavior Analysis

**Goal**: Add rules to the existing behavior analysis for more sophisticated threat detection.

1.  **Update `behavior_analysis.py` in `ai-service`**:
    Define and implement rules for loitering, fighting, and falling.

    ```python
    # filepath: ai-service/behavior_analysis.py

    class BehaviorAnalysisService:
        # ... existing code ...

        def _detect_behaviors(self, person_id: str, history: list):
            behaviors = []
            if self._is_loitering(history):
                behaviors.append({'type': 'loitering', 'threat': 'medium'})
            if self._is_fighting(history):
                behaviors.append({'type': 'fighting', 'threat': 'high'})
            # ... add more behavior checks ...
            return behaviors

        def _is_loitering(self, history: list) -> bool:
            # Check if a person's bounding box has low variance over a time threshold
            # ... implementation ...
            return True # or False

        def _is_fighting(self, history: list) -> bool:
            # Check for high velocity and variance in limb keypoints
            # ... implementation ...
            return True # or False
    ```

---

## Phase 3: Camera Integration & Streaming (Weeks 3-4)

### 3.1: RTSP Stream Ingestion

**Goal**: Build a robust service to connect to and manage multiple RTSP streams.

1.  **Create `stream_manager.py` in `ai-service`**:
    Use OpenCV to capture frames from RTSP URLs and put them into a processing queue.

    ```python
    # filepath: ai-service/stream_manager.py
    import cv2
    import threading
    from queue import Queue

    class StreamManager:
        def __init__(self):
            self.streams = {}
            self.processing_queue = Queue(maxsize=1000)

        def add_stream(self, camera_id: str, rtsp_url: str):
            if camera_id in self.streams: return
            stream_thread = threading.Thread(
                target=self._capture_loop,
                args=(camera_id, rtsp_url, self.processing_queue),
                daemon=True
            )
            self.streams[camera_id] = stream_thread
            stream_thread.start()

        def _capture_loop(self, camera_id, rtsp_url, queue):
            cap = cv2.VideoCapture(rtsp_url)
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break
                if not queue.full():
                    queue.put({'camera_id': camera_id, 'frame': frame})
            cap.release()
    ```

### 3.2: Stream Processing Pipeline

**Goal**: Create a pipeline to orchestrate frame analysis and result handling.

1.  **Create `streamProcessingService.ts` in `server/services`**:
    Use a message queue (like BullMQ with Redis) to manage the flow.

    ```typescript
    // filepath: server/services/streamProcessingService.ts
    import { Queue, Worker } from 'bullmq';
    import axios from 'axios';

    export class StreamProcessingService {
      private frameQueue: Queue;
      private resultQueue: Queue;

      constructor() {
        this.frameQueue = new Queue('frame-processing');
        this.resultQueue = new Queue('result-handling');
        this.initializeWorkers();
      }

      initializeWorkers() {
        // Worker to send frames to AI service
        new Worker('frame-processing', async (job) => {
          const { frameData } = job.data;
          const response = await axios.post('http://ai-service:8001/analyze/frame', { frame: frameData });
          await this.resultQueue.add('handle-result', response.data);
        });

        // Worker to process results from AI service
        new Worker('result-handling', async (job) => {
          const result = job.data;
          // 1. Store result in 'ai_detections' table
          // 2. Check threat level and create alert if necessary
          // 3. Emit result via WebSocket
        });
      }
    }
    ```

---

## Phase 4: Frontend & User Experience (Weeks 4-5)

### 4.1: Build Core UI Components

**Goal**: Create the main layout and reusable components for the dashboard.

1.  **Create `DashboardLayout.tsx`**:
    Build the main application shell with sidebar navigation.

    ```typescript
    // filepath: client/src/layouts/DashboardLayout.tsx
    import React from 'react';
    import { Outlet, Link } from 'react-router-dom';
    // Use an icon library like lucide-react

    export function DashboardLayout() {
      return (
        <div className="h-screen flex">
          {/* Sidebar */}
          <nav className="w-64 bg-gray-900 text-white">
            {/* Navigation Links */}
          </nav>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      );
    }
    ```

### 4.2: Implement Interactive Dashboard

**Goal**: Display live camera feeds and real-time analysis results.

1.  **Create `CameraGrid.tsx` and `LiveView.tsx`**:
    Build components to display camera streams and overlay AI analysis data received via WebSockets.

    ```typescript
    // filepath: client/src/components/camera/LiveView.tsx
    import React, { useEffect, useRef } from 'react';
    import { useSocket } from '../../hooks/useSocket';

    export function LiveView({ cameraId }) {
      const videoRef = useRef<HTMLVideoElement>(null);
      const canvasRef = useRef<HTMLCanvasElement>(null);
      const socket = useSocket();

      useEffect(() => {
        socket.on('camera-frame', (data) => {
          // Logic to display raw video frames if using WebRTC/MSE
        });

        socket.on('analysis-result', (data) => {
          if (data.cameraId === cameraId) {
            // Draw bounding boxes, skeletons, etc. on the canvas
            const ctx = canvasRef.current.getContext('2d');
            // ... drawing logic ...
          }
        });

        return () => {
          socket.off('camera-frame');
          socket.off('analysis-result');
        };
      }, [socket, cameraId]);

      return (
        <div className="relative">
          <video ref={videoRef} autoPlay muted />
          <canvas ref={canvasRef} className="absolute top-0 left-0" />
        </div>
      );
    }
    ```

---

## Phase 5: Testing, Deployment, & Documentation (Weeks 5-6)

### 5.1: API and End-to-End Testing

**Goal**: Ensure all services work together as expected.

1.  **Write Integration Tests**:
    Use `supertest` for backend API testing and `Playwright` for end-to-end UI testing.

    ```javascript
    // Example Playwright test
    test('should display real-time alerts on the dashboard', async ({ page }) => {
      await page.goto('/');
      // Simulate a high-threat event from the backend
      // ...
      // Assert that an alert notification appears on the page
      const alert = await page.waitForSelector('.alert-notification');
      expect(alert).not.toBeNull();
    });
    ```

### 5.2: Deployment to Staging & Production

**Goal**: Deploy the application to a cloud environment.

1.  **Create CI/CD Pipeline**:
    Use GitHub Actions to automate testing, building Docker images, and deploying to a cloud provider (e.g., AWS ECS, Vercel).

2.  **Configure Infrastructure as Code**:
    Use Terraform or AWS CDK to define cloud resources (databases, S3 buckets, load balancers).
