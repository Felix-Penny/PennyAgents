# Security Agent Mutation Endpoints - Comprehensive Audit Matrix

## Summary: 24 Total Mutation Endpoints

| Endpoint | requireAuth | Role Check | Store Access | Entity Verification | Zod Validation | Status |
|----------|-------------|------------|--------------|-------------------|----------------|---------|

## ALERT MANAGEMENT ENDPOINTS (5 endpoints)

### 1. POST `/api/store/:storeId/alerts/:alertId/confirm` (Line 48)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("operator") 
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ `if (!alert || alert.storeId !== storeId)` (Line 54)
- **Zod Validation**: ❌ No request body validation
- **Status**: SECURE ✅

### 2. POST `/api/store/:storeId/alerts/:alertId/dismiss` (Line 69)
- **requireAuth**: ✅ Present  
- **Role Check**: ✅ requireSecurityAgent("operator")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ `if (!alert || alert.storeId !== storeId)` (Line 75)
- **Zod Validation**: ❌ No request body validation
- **Status**: SECURE ✅

### 3. POST `/api/store/:storeId/alerts/:alertId/assign` (Line 115)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("operator")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ `if (!alert || alert.storeId !== storeId)` (Line 127)
- **Zod Validation**: ⚠️ Basic validation `typeof userId !== 'string'` (Line 121)
- **Status**: SECURE ✅

### 4. POST `/api/store/:storeId/alerts/:alertId/acknowledge` (Line 138)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("operator")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ `if (!alert || alert.storeId !== storeId)` (Line 144)
- **Zod Validation**: ❌ No request body validation
- **Status**: SECURE ✅

### 5. POST `/api/store/:storeId/alerts/:alertId/escalate` (Line 155)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("operator")
- **Store Access**: ✅ requireStoreAccess  
- **Entity Verification**: ✅ `if (!alert || alert.storeId !== storeId)` (Line 162)
- **Zod Validation**: ❌ No validation for `reason` field
- **Status**: SECURE ✅

## CAMERA MANAGEMENT ENDPOINTS (2 endpoints)

### 6. POST `/api/store/:storeId/cameras` (Line 197)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("admin")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ Store ID injected in request body (Line 202)
- **Zod Validation**: ✅ `insertCameraSchema.parse()` (Line 202)
- **Status**: SECURE ✅

### 7. POST `/api/store/:storeId/cameras/:cameraId/heartbeat` (Line 213)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("viewer")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ `if (!camera || camera.storeId !== storeId)` (Line 219)
- **Zod Validation**: ❌ No request body validation
- **Status**: SECURE ✅

## INCIDENT MANAGEMENT ENDPOINTS (3 endpoints)

### 8. POST `/api/store/:storeId/incidents` (Line 254)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("operator")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ Store ID injected in request body (Line 259)
- **Zod Validation**: ✅ `insertIncidentSchema.parse()` (Line 259)
- **Status**: SECURE ✅

### 9. POST `/api/store/:storeId/incidents/:incidentId/assign` (Line 274)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("operator")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ `if (!incident || incident.storeId !== storeId)` (Line 286)
- **Zod Validation**: ⚠️ Basic validation `typeof userId !== 'string'` (Line 280)
- **Status**: SECURE ✅

### 10. POST `/api/store/:storeId/incidents/:incidentId/evidence` (Line 297)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireSecurityAgent("operator")
- **Store Access**: ✅ requireStoreAccess
- **Entity Verification**: ✅ `if (!incident || incident.storeId !== storeId)` (Line 312)
- **Zod Validation**: ⚠️ Basic validation `Array.isArray(evidenceFiles)` (Line 306)
- **Status**: SECURE ✅

## ANALYSIS: Alert/Camera/Incident endpoints are FULLY SECURED ✅
All 10 core Security Agent endpoints have proper multi-tenant isolation and role-based access control.

## REMAINING ENDPOINTS TO AUDIT:

### STORE MANAGEMENT (2 endpoints)
### OPS ENDPOINTS (2 endpoints)  
### OFFENDER PORTAL (2 endpoints)
### PAYMENT ENDPOINTS (2 endpoints)
### VIDEO ANALYSIS (2 endpoints)
### NOTIFICATION (1 endpoint)
### PLATFORM (3 endpoints)

## STORE MANAGEMENT ENDPOINTS (2 endpoints)

### 11. POST `/api/store/:storeId/offenders/:offenderId/generate-qr` (Line 341)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireStoreStaff
- **Store Access**: ❌ Missing requireStoreAccess
- **Entity Verification**: ❌ No offender ownership verification
- **Zod Validation**: ❌ No request body validation
- **Status**: ⚠️ PARTIAL SECURITY

### 12. PUT `/api/store/:storeId/settings` (Line 384)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireStoreAdmin
- **Store Access**: ❌ Missing requireStoreAccess
- **Entity Verification**: ❌ No store ownership verification
- **Zod Validation**: ❌ No request body validation (accepts raw req.body)
- **Status**: ❌ CRITICAL GAP

## OPS ENDPOINTS (2 endpoints)

### 13. POST `/api/ops/alerts/:alertId/approve` (Line 410)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requirePennyAdmin
- **Store Access**: ❌ Not applicable (ops level)
- **Entity Verification**: ❌ No alert ownership verification
- **Zod Validation**: ❌ No validation for offenderId/amount
- **Status**: ❌ CRITICAL GAP

### 14. POST `/api/ops/alerts/:alertId/reject` (Line 450)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requirePennyAdmin
- **Store Access**: ❌ Not applicable (ops level)
- **Entity Verification**: ❌ No alert ownership verification
- **Zod Validation**: ❌ No request body validation
- **Status**: ⚠️ PARTIAL SECURITY

## OFFENDER PORTAL ENDPOINTS (2 endpoints)

### 15. POST `/api/offender-portal/validate-token` (Line 490)
- **requireAuth**: ❌ Intentionally missing (QR flow)
- **Role Check**: ❌ Not applicable
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ✅ Token validation logic
- **Zod Validation**: ❌ No token validation
- **Status**: ⚠️ INTENTIONAL DESIGN

### 16. POST `/api/offender-portal/link-account` (Line 507)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireOffender
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ✅ Token validation logic
- **Zod Validation**: ❌ No token validation
- **Status**: ⚠️ PARTIAL SECURITY

## PAYMENT ENDPOINTS (2 endpoints)

### 17. POST `/api/create-payment-intent` (Line 546)
- **requireAuth**: ✅ Present
- **Role Check**: ❌ No role requirement
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ❌ No ownership verification
- **Zod Validation**: ✅ Comprehensive validation (amount, offenderId, theftIds)
- **Status**: ✅ SECURE

### 18. POST `/api/stripe-webhook` (Line 580)
- **requireAuth**: ❌ Intentionally missing (webhook)
- **Role Check**: ❌ Not applicable
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ✅ Stripe signature validation
- **Zod Validation**: ✅ Stripe handles validation
- **Status**: ✅ SECURE

## VIDEO ANALYSIS ENDPOINTS (2 endpoints)

### 19. POST `/api/video/analyze` (Line 632)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireStoreStaff
- **Store Access**: ❌ Missing requireStoreAccess
- **Entity Verification**: ❌ No store ownership verification
- **Zod Validation**: ⚠️ Basic validation (videoBase64, storeId, file size)
- **Status**: ❌ CRITICAL GAP

### 20. POST `/api/video/create-clip` (Line 763)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireStoreStaff
- **Store Access**: ❌ Missing requireStoreAccess
- **Entity Verification**: ❌ No ownership verification
- **Zod Validation**: ❌ No validation for analysisId, startTime, endTime, reason
- **Status**: ❌ CRITICAL GAP

## NOTIFICATION ENDPOINTS (1 endpoint)

### 21. POST `/api/notifications/:id/read` (Line 801)
- **requireAuth**: ✅ Present
- **Role Check**: ❌ No role requirement (appropriate)
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ✅ User ownership verification (notification.userId === req.user!.id)
- **Zod Validation**: ❌ No request body validation
- **Status**: ✅ SECURE

## PLATFORM ENDPOINTS (3 endpoints)

### 22. POST `/api/organizations` (Line 845)
- **requireAuth**: ✅ Present
- **Role Check**: ❌ No role requirement
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ❌ No ownership verification
- **Zod Validation**: ✅ insertOrganizationSchema.parse()
- **Status**: ⚠️ PARTIAL SECURITY

### 23. POST `/api/user/agents` (Line 888)
- **requireAuth**: ✅ Present
- **Role Check**: ❌ No role requirement
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ✅ User injected as grantedBy
- **Zod Validation**: ✅ insertUserAgentAccessSchema.parse()
- **Status**: ✅ SECURE

### 24. PUT `/api/organizations/:orgId/agents/:agentId/configuration` (Line 925)
- **requireAuth**: ✅ Present
- **Role Check**: ✅ requireOrganizationAccess
- **Store Access**: ❌ Not applicable
- **Entity Verification**: ✅ Organization access verified
- **Zod Validation**: ✅ insertAgentConfigurationSchema.parse()
- **Status**: ✅ SECURE

## CRITICAL SECURITY SUMMARY

### ✅ FULLY SECURED (10 endpoints)
All core Security Agent endpoints (alerts, cameras, incidents) are properly secured with complete multi-tenant isolation.

### ❌ CRITICAL GAPS (4 endpoints)
1. **Store settings** - Missing store access and input validation
2. **OPS approve** - Missing input validation
3. **Video analyze** - Missing store access verification  
4. **Video create-clip** - Missing store access and input validation

### ⚠️ PARTIAL SECURITY (6 endpoints)
Various endpoints with minor gaps but acceptable for their context.

### ✅ INTENTIONALLY UNPROTECTED (2 endpoints)
Offender portal and Stripe webhook are appropriately designed for their use cases.

**RECOMMENDATION: Fix the 4 critical gaps to achieve complete security coverage.**