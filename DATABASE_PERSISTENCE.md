## Data Persistence Solution for Railway Deployment

### The Problem
Currently, **all user data gets deleted on every deployment** because:
- SQLite database file is stored in container filesystem
- Railway containers are ephemeral (reset on each deployment)
- No persistent storage is configured

### Current Status
✅ **During normal operation**: All data (users, detections, alerts) persists correctly  
❌ **After deployment**: All data is lost, users must re-register  

### Solutions

#### Option 1: Quick Fix - Persistent Volume (Railway)
Add persistent storage to Railway service:
1. Go to Railway dashboard
2. Add a Volume to the service
3. Mount it to `/app/data`
4. Change SQLite path to `/app/data/penny-detections.db`

#### Option 2: PostgreSQL Database (Recommended)
1. **Add PostgreSQL service** in Railway dashboard
2. **Connect DATABASE_URL** environment variable
3. **Auto-migration** - code will detect PostgreSQL and use it
4. **Zero data loss** on deployments

#### Option 3: Manual User Recreation
For now, after each deployment:
```bash
curl -X POST "https://pennyagents-production.up.railway.app/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "YOUR_EMAIL@example.com",
    "password": "YOUR_SECURE_PASSWORD",
    "confirmPassword": "YOUR_SECURE_PASSWORD", 
    "name": "Your Name"
  }'
```

### Database Routes Status

#### ✅ Working Routes:
- `POST /api/register` - User registration
- `POST /api/login` - User authentication  
- `GET /api/user` - Get current user
- `GET /api/debug/users` - List all users
- `GET /api/debug/database` - Database overview
- `GET /api/cameras` - List cameras
- `GET /api/health` - Health check

#### ⚠️ Routes Need Testing:
- `GET /api/detections` - Recent detections
- `GET /api/alerts` - Alert management
- `POST /api/alerts/resolve` - Resolve alerts
- Camera management routes

#### 🔧 Database Operations:
- **CREATE**: ✅ Users, cameras auto-created
- **READ**: ✅ All queries working
- **UPDATE**: ✅ User sessions, camera status
- **DELETE**: ✅ Works but data lost on deployment

### Next Steps:

1. **Immediate**: Set up PostgreSQL on Railway
2. **Short-term**: Test all API routes end-to-end  
3. **Long-term**: Add data backup/restore functionality

### Testing Commands:
```bash
# Check current data
curl -s "https://pennyagents-production.up.railway.app/api/debug/database" | jq .

# Test login
curl -X POST "https://pennyagents-production.up.railway.app/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "YOUR_EMAIL@example.com", "password": "YOUR_PASSWORD"}'

# Create test detection data  
curl -X POST "https://pennyagents-production.up.railway.app/api/debug/create-test-data"
```