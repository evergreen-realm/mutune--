# OPEN_QUESTIONS.md — MutuneRent Pro

## Task 6: Hardcoded Admin Password (Backend — Off Limits)

**File:** `backend/utils/security.js`, line 12  
**Issue:** `getAdminPassword()` falls back to `'MutuneAdmin2026!'` when no env var is set.  
**Recommended fix (requires backend access):**

```diff
- return 'MutuneAdmin2026!';
+ throw new Error('ADMIN_PASSWORD environment variable is required. Set ADMIN_PASSWORD or ADMIN_HARDCODED_PASSWORD in your .env');
```

**Why this is blocked:** The project directive states "Backend is fully off-limits." This change must be applied manually or in a future backend-approved session.

---

## Task 2: Real Building Models

**Current state:** `BuildingPreview3D.jsx` and `VoxelBuildingMini3D.jsx` both use procedural `boxGeometry` primitives (plain boxes) instead of real architectural meshes.

**Decision needed:**
1. **Free CC0 packs** (Kenney, Poly Pizza, Quaternius) — fastest, free, no licensing issues
2. **Custom models** — commission or model in Blender
3. **Keep procedural but improve** — add rooflines, window recesses, balcony overhangs using BufferGeometry

**What's ready now:** `@react-three/drei` is installed with `useGLTF`. Once `.glb` files are placed in `frontend/public/models/`, the components can be updated to use `useGLTF('/models/building_small.glb')` etc.

**Blocking question:** Which model source do you want to use? Drop `.glb` files into `frontend/public/models/` and I'll wire them up.

## Phase 1: 3D Buildings
- 3D models are static CC0 packs (Task 1.1–1.2). Meshy/Tripo3D keys are scaffolded in `.env.example` for a possible future switch to per-property AI-generated models; not active.
- **Backend Model 3D Call**: `backend/services/model3d.js` is currently imported and called inside `backend/routes/properties.js` (lines 232 and 676) upon property creation and submission. Since the backend is off-limits under current rules, these references have been left intact but flagged.
