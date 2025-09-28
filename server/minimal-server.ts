import express from "express";
import { createServer } from "http";

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Basic Health Check'
  });
});

const server = createServer(app);
const port = 3005;

server.listen(port, "127.0.0.1", () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health: http://localhost:${port}/api/health`);
});