import Database from 'better-sqlite3';
import pkg from 'pg';
const { Pool } = pkg;

class DatabaseManager {
  constructor() {
    console.log('🔧 DatabaseManager constructor called');
    console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
    
    this.usePostgres = process.env.DATABASE_URL ? true : false;
    console.log('📊 Will use PostgreSQL:', this.usePostgres);
    
    this.db = null;
    this.pool = null;
    this.init();
  }

  init() {
    if (this.usePostgres && process.env.DATABASE_URL) {
      console.log('🐘 Initializing PostgreSQL connection...');
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      this.createPostgresTables();
    } else {
      console.log('📁 Initializing SQLite database...');
      this.db = new Database('penny-detections.db');
      this.createSQLiteTables();
    }
  }

  createSQLiteTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        frame_id TEXT NOT NULL,
        camera_id TEXT DEFAULT 'default_camera',
        timestamp TEXT NOT NULL,
        confidence REAL,
        detection_type TEXT,
        threat_level TEXT,
        objects_detected TEXT,
        modal_response TEXT,
        image_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        detection_id INTEGER,
        alert_type TEXT NOT NULL,
        confidence REAL,
        location TEXT,
        description TEXT,
        status TEXT DEFAULT 'active',
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (detection_id) REFERENCES detections(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE,
        password_hash TEXT,
        agent_name TEXT,
        role TEXT DEFAULT 'agent',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        stream_url TEXT,
        stream_type TEXT DEFAULT 'rtsp',
        status TEXT DEFAULT 'offline',
        last_heartbeat DATETIME,
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.insertDemoCameras();
  }

  async createPostgresTables() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS detections (
          id SERIAL PRIMARY KEY,
          frame_id VARCHAR(255) NOT NULL,
          camera_id VARCHAR(50) DEFAULT 'default_camera',
          timestamp TIMESTAMP NOT NULL,
          confidence REAL,
          detection_type VARCHAR(100),
          threat_level VARCHAR(50),
          objects_detected JSONB,
          modal_response JSONB,
          image_data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS alerts (
          id SERIAL PRIMARY KEY,
          detection_id INTEGER REFERENCES detections(id),
          alert_type VARCHAR(100) NOT NULL,
          confidence REAL,
          location VARCHAR(255),
          description TEXT,
          status VARCHAR(50) DEFAULT 'active',
          resolved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(255) UNIQUE,
          password_hash VARCHAR(255),
          agent_name VARCHAR(255),
          role VARCHAR(50) DEFAULT 'agent',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cameras (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          location VARCHAR(255),
          stream_url TEXT,
          stream_type VARCHAR(50) DEFAULT 'rtsp',
          status VARCHAR(50) DEFAULT 'offline',
          last_heartbeat TIMESTAMP,
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.insertDemoCamerasPostgres(client);
    } finally {
      client.release();
    }
  }

  insertDemoCameras() {
    const insertCamera = this.db.prepare(`
      INSERT OR IGNORE INTO cameras (id, name, location, stream_url, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    const cameras = [
      ['cam_001', 'Main Entrance', 'Front Door', 'rtsp://demo:demo@camera1.local:554/stream1', 'online'],
      ['cam_002', 'Electronics Section', 'Store Floor - Electronics', 'rtsp://demo:demo@camera2.local:554/stream1', 'online'],
      ['cam_003', 'Checkout Area', 'Cashier Stations', 'rtsp://demo:demo@camera3.local:554/stream1', 'offline']
    ];

    cameras.forEach(camera => insertCamera.run(...camera));
  }

  async insertDemoCamerasPostgres(client) {
    const cameras = [
      ['cam_001', 'Main Entrance', 'Front Door', 'rtsp://demo:demo@camera1.local:554/stream1', 'online'],
      ['cam_002', 'Electronics Section', 'Store Floor - Electronics', 'rtsp://demo:demo@camera2.local:554/stream1', 'online'],
      ['cam_003', 'Checkout Area', 'Cashier Stations', 'rtsp://demo:demo@camera3.local:554/stream1', 'offline']
    ];

    for (const camera of cameras) {
      await client.query(`
        INSERT INTO cameras (id, name, location, stream_url, status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, camera);
    }
  }

  // Unified query interface
  async query(sql, params = []) {
    if (this.usePostgres) {
      const client = await this.pool.connect();
      try {
        const result = await client.query(sql, params);
        return result.rows;
      } finally {
        client.release();
      }
    } else {
      // Convert PostgreSQL-style queries to SQLite
      const sqliteQuery = sql.replace(/\$(\d+)/g, '?');
      try {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          return this.db.prepare(sqliteQuery).all(...params);
        } else {
          const result = this.db.prepare(sqliteQuery).run(...params);
          return [{ id: result.lastInsertRowid, changes: result.changes }];
        }
      } catch (error) {
        console.error('SQLite query error:', error);
        throw error;
      }
    }
  }

  // Get a single row
  async get(sql, params = []) {
    const results = await this.query(sql, params);
    return results[0] || null;
  }

  // Get all rows
  async all(sql, params = []) {
    return await this.query(sql, params);
  }

  // Execute a statement (INSERT, UPDATE, DELETE)
  async run(sql, params = []) {
    return await this.query(sql, params);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
    if (this.db) {
      this.db.close();
    }
  }
}

export default DatabaseManager;