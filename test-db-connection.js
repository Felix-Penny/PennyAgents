// Simple test to verify PostgreSQL connection
import DatabaseManager from './database-manager.js';

async function testConnection() {
  const dbManager = new DatabaseManager();
  
  try {
    console.log('🔍 Testing database connection...');
    console.log('Database type:', dbManager.usePostgres ? 'PostgreSQL' : 'SQLite');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    // Test basic connection
    const result = await dbManager.query('SELECT 1 as test');
    console.log('✅ Database connection successful:', result);
    
    // Check if users table exists and has data
    const users = await dbManager.all('SELECT id, email, username, agent_name FROM users LIMIT 5');
    console.log('👤 Users found:', users.length);
    console.log('Users data:', users);
    
    // Check if username column exists
    if (dbManager.usePostgres) {
      const columns = await dbManager.all(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      console.log('📋 Users table columns:', columns);
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await dbManager.close();
  }
}

testConnection();