import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { DEFAULT_OPENAI_MODEL } from "./ai/openaiConfig";
import { setupVite, serveStatic, log } from "./vite";

// Environment validation for Object Storage
function validateEnvironment() {
  const requiredEnvVars = ['DATABASE_URL'];
  const objectStorageEnvVars = ['PUBLIC_OBJECT_SEARCH_PATHS', 'PRIVATE_OBJECT_DIR'];
  
  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  // Check object storage environment variables
  let objectStorageConfigured = true;
  const missingObjectStorageVars = [];
  
  for (const envVar of objectStorageEnvVars) {
    if (!process.env[envVar]) {
      objectStorageConfigured = false;
      missingObjectStorageVars.push(envVar);
    }
  }

  if (!objectStorageConfigured) {
    log(`Warning: Object Storage not fully configured. Missing: ${missingObjectStorageVars.join(', ')}`);
    log('Create a bucket in Object Storage tool and set the required environment variables');
  } else {
    log('Object Storage environment validation passed');
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Validate environment variables at startup
  validateEnvironment();

  // OpenAI startup info
  if (!process.env.OPENAI_API_KEY) {
    log("Warning: OPENAI_API_KEY is not set. OpenAI-powered features will be unavailable.");
  } else {
    log(`[OpenAI] Default model: ${DEFAULT_OPENAI_MODEL}`);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
