## 11. Cross-Portal Functional Integration (No Static UI Stubs for Core Features)

When introducing a new feature or component (e.g., 3D Model Viewer, Gaussian Splats, Interactive Maps):
1. **Integrate Everywhere:** The feature must be integrated into all relevant portals (Agent Dashboard, Landlord Dashboard, Tenant Portal) using the actual functional components (e.g., <BuildingPreview3D>, <SplatViewerModal>), not placeholder static images.
2. **Decoupled Routing:** Do not bundle fundamentally different views (e.g., a 2D list and a 3D canvas) into a single UI tab toggled by an unrelated parent state flag. Each distinct functional view must have its own dedicated tab or routing state.
3. **Graceful Fallbacks:** If a high-end feature (like a .splat file) is unavailable for a given entity, implement a programmatic fallback to the previous functional component (e.g., the .glb Blender model), never to an empty stub or static image, unless explicitly required.



## 12. Mapbox Custom WebGL Preservation (No setStyle for Toggles)

When working on Mapbox implementations that include Custom WebGL Layers (e.g., Three.js integrations for 3D buildings):
1. **Never use map.setStyle() to toggle views** (like switching to satellite mode) after initial load. This function violently destroys the underlying WebGL context, causing Three.js to crash (ratio is not defined).
2. **Use Raster Overlays for Toggles:** To implement a satellite toggle, add a persistent raster source (mapbox://mapbox.satellite) and a raster layer below the custom 3D layers. Toggle its visibility using map.setLayoutProperty('layer-id', 'visibility', 'visible' | 'none').
3. **Respect Existing Workarounds:** If you see a seemingly 'hacky' manual layer injection in a Mapbox component, do not refactor it into a setStyle prop without first verifying if the map uses custom WebGL layers that depend on context preservation.

## 13. Production Deployment Rules

When asked to deploy to a production URL, ALWAYS use the official CLIs rather than relying exclusively on GitHub pushes:

1. **Frontend Deployment**:
   - MUST be deployed via Vercel.
   - Command: `npx vercel --prod --yes --token $VERCEL_TOKEN`
   - Execution context: MUST be run from the repository root (not inside `frontend/`), because Vercel path mapping expects the root to resolve the workspace structure.
   - Vercel automatically generates a new `.vercel.app` URL for each snapshot, but aliased domains will update automatically. Do not manually alias or delete Vercel URLs unless requested.

2. **Backend Deployment**:
   - MUST be deployed via Render.
   - Command: Make a POST request to the Render Deploy Hook.
   - Execution context: The API hook will pull from the `main` branch. Ensure code is committed and pushed before triggering the hook.

3. **Secrets Handling**:
   - Deployment tokens (e.g., `VERCEL_TOKEN`) must never be written into `AGENTS.md` or committed to source control. Read them dynamically from `.env.local` or environment variables.


## 14. Universal WebRTC Camera Constraints & Dual Video Input Modes

When implementing components that rely on WebRTC camera streams (e.g., 3D Room Scanners, Photo Capture Modals, Document Scanners):
1. **Never use rigid facingMode constraints:** Do not use exact object `{ facingMode: "environment" }`. Always use soft ideal constraints `{ facingMode: { ideal: "environment" } }` so the browser gracefully falls back to available webcams on desktop PCs and laptops.
2. **Implement Fallback Media & Error Handlers:** Always provide `onUserMediaError` handling and fallback UI state.
3. **Provide Dual Input Modes (Live Camera + Video/File Path):** Always include an alternative "Upload 360° Video" option alongside live webcam capture, allowing users on desktop PCs to upload real 360° room video files and extract spatial sector frames seamlessly.


## 15. 3D Scan Pipeline Modes (Do Not Confuse)

The Add Property 3D scan has exactly these modes and pipelines:
- **Mode 1 (Live Camera)**: Triggered by "Launch 360° Room Capture HUD" button. The primary capture flow. KEEP.
- **Mode 2 (Upload 360 Video)**: Tab inside the GuidedPhotoCaptureModal. Alternative fallback for pre-recorded video. KEEP.
- **Mode 3 (Direct .splat Upload)**: The "Direct .splat / 3D Asset File" ImageUpload field on the Add Property page. This is the STUB — it was removed per user instruction. Do NOT re-add.
- **Blender Pipeline**: The "3D Exterior Building Model (.glb)" checkbox on Add Property. This is a completely separate backend pipeline for exterior .glb generation. KEEP and maintain.

Never confuse the Blender pipeline with the Gaussian Splatting pipeline. They are independent.

## 16. WebRTC Motion Detection: No Raw Pixel Differencing

When implementing camera motion tracking for room scanning or similar features:
1. **Never use raw pixel luminance differencing** to estimate camera motion. Video sensor noise, compression artifacts, and auto-exposure cause false positives that trigger phantom movement.
2. **Use block-matching (SAD/SSD)** with a configurable dead zone threshold. Divide frames into blocks (e.g., 8×8), search for best match in previous frame, and compute displacement vectors.
3. **Always implement a dead zone**: If average displacement < threshold (e.g., 3px), treat as stationary. Do NOT update angle or trigger captures.

## 17. iOS DeviceOrientationEvent Permission

`DeviceOrientationEvent.requestPermission()` on iOS 13+ MUST be called from a **user gesture** (click/tap event handler). Calling it from `useEffect`, `setTimeout`, or any non-gesture context will be silently rejected by Safari. Always gate sensor activation behind a "Start Scanning" or "Enable Sensors" button tap.


## 18. Safely Appending to Configuration Files

When appending new keys, environment variables, or content to an existing .env file or any configuration file using CLI tools (like Add-Content, echo >>, etc.):
1. **Always ensure a trailing newline exists:** Prepend your payload with a newline (e.g., \nMODAL_URL=...) to guarantee it does not concatenate with the last line of the file.
2. **Verify after appending:** Always cat or view the tail of the modified file to ensure the new keys are properly formatted and haven't corrupted the previous line's value. 
3. This is especially critical for credentials, service IDs, and tokens where trailing or leading characters cause silent authentication or routing failures.

## 19. React Hook Refactoring & Dependency Arrays
When removing variables from object destructuring (e.g., from custom hooks, contexts, or props), you MUST verify that those variables are not referenced anywhere else in the file. Pay critical attention to useEffect, useCallback, and useMemo dependency arrays. Undeclared identifiers left in dependency arrays will cause immediate runtime ReferenceError crashes during the render phase, crashing the entire page before the component even mounts or opens.

## 20. No Full-File Rewrites Without Explicit Approval

When editing an existing file:
1. **Measure your diff before committing.** If your edit deletes more than 30% of the file's total lines, STOP and ask the user for explicit approval before proceeding. Show them the deletion count.
2. **Use multi_replace_file_content for surgical edits.** Target specific line ranges. Do not replace the entire file content.
3. **If you believe a full rewrite is necessary**, explain why in your implementation plan with specific justification for why the existing code cannot be incrementally improved. The user must approve the rewrite explicitly.
4. **Never rewrite a file that you haven't fully read first.** View the entire file before editing. A common failure mode is writing "what the file should contain" from memory or a mental model, which silently deletes working code the agent didn't know about.

## 21. Verify Runtime File Paths Before Committing

When writing code that references a file path at runtime (a model, image, config, static asset, etc.):
1. **Run `ls` or `Get-ChildItem` on the directory** to confirm the exact filename before hardcoding it.
2. **Paste the command output** in your verification section.
3. **Never assume a filename** — even if it was correct in a previous commit, it may have been renamed or deleted.
4. This applies to: GLB/GLTF model paths, image URLs, JSON configs, font files, favicon paths, and any other static asset referenced by string literal in code.

## 22. 3D Scan Live Camera is Mobile-Only

The "Launch 360° Room Capture HUD" live camera mode requires physical 360° rotation of the device camera. This is only possible on mobile phones and tablets with gyroscopes.

1. **Never enable Live Camera mode on desktop/laptop browsers.** Desktop webcams are physically fixed and cannot capture 360° coverage. Mouse-drag workarounds only move a virtual compass, not the actual camera angle — resulting in duplicate frames that are useless for 3D reconstruction.
2. **On desktop, show only the Video Upload tab** with clear instructions: "Record a 360° video on your phone, then upload it here."
3. **Device detection**: Use `isTouchDevice` (from `'ontouchstart' in window || navigator.maxTouchPoints > 0`) to gate Live Camera mode.
4. **Never remove the 3D scan feature from desktop entirely** — the Video Upload path is a valid desktop workflow.
5. **DeviceOrientation beta normalization**: `event.beta` = 90° when phone is upright (normal scanning position). Always normalize: `pitch = beta - 90` so upright = level (0°). Raw beta causes permanent "Level the camera" blocking.
