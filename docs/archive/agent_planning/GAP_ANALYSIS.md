# FULL-SCALE GAP ANALYSIS (BACKEND & FRONTEND)

## 1. Backend Gap Analysis

| Feature Area | Status | Gaps Identified | Planned Remediation |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | **Halfway Done** | Middleware exists (`requireRole`), but some routes lack proper scope boundaries (e.g., users can edit properties they don't own). | Add resource-level authorization checks in controllers (owner/admin matching). |
| **3D Scan API (`scans.js`)** | **Complete** | Route created and integrated with Model3D service. Missing validation of webhook payload signature from Modal. | Add HMAC signature validation to `/api/v1/scans/webhook`. |
| **Property Management** | **Poorly Done** | `addProperty` handles basic fields but doesn't handle transactions or rollbacks if image uploads to Cloudflare fail midway. | Implement MongoDB transactions (`session.withTransaction`) for creation and deletion. |
| **Blender Server Path** | **Complete** | Added `BLENDER_SERVER_PATH` to `.env` and `render.yaml`. Dynamic path switching implemented. | No further action required. |
| **Payment & MPesa Integration** | **Halfway Done** | Safaricom MPesa integration exists but lacks robust polling/callback retry logic for failed transactions. | Implement exponential backoff in MPesa callback verification. |
| **Data Validation** | **Poorly Done** | Mongoose schemas are strict, but missing Joi/Zod request validation at the router level. | Add `express-validator` or `zod` middleware for incoming requests. |
| **Error Handling** | **Poorly Done** | Custom `AppError` exists, but many async controllers don't use a `catchAsync` wrapper, leading to unhandled promise rejections. | Wrap all controller functions in a `catchAsync` utility. |

---

## 2. Frontend Gap Analysis

| Feature Area | Status | Gaps Identified | Planned Remediation |
| :--- | :--- | :--- | :--- |
| **Property Upload Forms** | **Halfway Done** | Floor plan and images are uploaded, but no client-side compression before sending to the server. | Implement `browser-image-compression` on `AddPropertyPage.jsx`. |
| **360° Splat Capture UI** | **Complete** | `GuidedPhotoCaptureModal.jsx` provides radar HUD and angle tracker correctly. | No further action required. |
| **MapWidget WebGL** | **Complete** | WebGL Error Boundary, 75° pitch, exact height extrusion all applied. | No further action required. |
| **Role-Based Routing** | **Poorly Done** | UI buttons are sometimes hidden based on role, but React Router doesn't protect the actual routes securely. | Implement `<ProtectedRoute>` wrapper checking Redux/Context user role. |
| **State Management** | **Poorly Done** | Excessive local state in massive components (e.g., `TenantPortalPage.jsx` is 91KB). | Refactor into smaller sub-components and migrate shared state to Redux/Zustand. |

---

## 3. Conclusion
The most critical vulnerabilities lie in **Resource-Level Authorization (Backend)** and **Client-Side Route Protection (Frontend)**. The codebase needs a significant refactor to wrap controllers in error handlers and implement database transactions for multi-step uploads.
