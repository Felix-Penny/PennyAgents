#!/bin/bash
echo "🔧 Testing PostgreSQL Connection Status"

echo ""
echo "1. Testing Health Endpoint:"
curl -s "https://pennyagents-production.up.railway.app/api/health" | jq .

echo ""
echo "2. Testing Current Database Type:"
curl -s "https://pennyagents-production.up.railway.app/api/debug/database" | jq '.tables.users.recent[0] | keys'

echo ""
echo "3. Testing User Structure:"
curl -s "https://pennyagents-production.up.railway.app/api/debug/users" | jq '.users[0]'

echo ""
echo "4. Test Registration with Username:"
curl -X POST "https://pennyagents-production.up.railway.app/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass123",
    "confirmPassword": "TestPass123",
    "firstName": "Test",
    "lastName": "User"
  }' | jq .

echo ""
echo "5. Check Updated Users:"
curl -s "https://pennyagents-production.up.railway.app/api/debug/users" | jq '.users[] | {id, email, username, agent_name}'