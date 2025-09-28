# DNS Configuration for www.pennyagents.com

## Current Status
✅ Railway domain configuration: COMPLETE
- Primary domain: https://www.pennyagents.com
- Railway target: pennyagents-production.up.railway.app

## Required DNS Records

### 1. Primary CNAME Record
```
Type: CNAME
Name: www
Value: pennyagents-production.up.railway.app
TTL: 300 (5 minutes)
```

### 2. Root Domain Redirect (Optional but Recommended)
```
Type: CNAME
Name: @
Value: pennyagents-production.up.railway.app
TTL: 300 (5 minutes)
```

### 3. Alternative A Records (if CNAME not supported for root)
First get the IP addresses:
```bash
nslookup pennyagents-production.up.railway.app
```

Then set A records for both:
```
Type: A
Name: @
Value: [Railway IP Address]
TTL: 300

Type: A  
Name: www
Value: [Railway IP Address]
TTL: 300
```

## DNS Provider Instructions

### For Cloudflare:
1. Go to DNS management for pennyagents.com
2. Add CNAME record: `www` → `pennyagents-production.up.railway.app`
3. Set Proxy status to "DNS only" (gray cloud)

### For GoDaddy:
1. Go to DNS Management
2. Add CNAME record with Host: `www`, Points to: `pennyagents-production.up.railway.app`

### For Namecheap:
1. Go to Advanced DNS
2. Add CNAME record: Host `www`, Value `pennyagents-production.up.railway.app`

## Verification
After DNS propagation (5-60 minutes), verify:
```bash
curl -I https://www.pennyagents.com/api/health
```

Should return: HTTP/2 200 OK

## SSL Certificate
Railway will automatically provision SSL certificate once DNS is properly configured.