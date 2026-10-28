# MUTUNERENT_3D_FIX_LOOP_v2.md
**Agent directive — fix loop, not a rebuild. Every finding below was confirmed by reading the live code at commit `9f6d382` and running a real production build, not inferred.**

---

## 0. Read this first

The previous two commits (`66379c7`, `9f6d382`) did **not** fix the core complaint: buildings are still procedurally-generated boxes with no architectural shape, in both "Cinematic" and "Interactive" modes. They also left the map's marker system in a worse state (three overlapping techniques instead of one), touched backend files that weren't authorized, and hardcoded a real API credential into the repo. None of this is guesswork — see the evidence cited under each task.

This is a fix loop: five scoped tasks, in dependency order. Do not batch them into one commit.

---

## 1. Non-negotiable rules for this pass

- **`backend/` is fully off-limits.** Not "don't touch `api.js`" — the entire directory. If a task seems to need a backend change, stop, write it to `OPEN_QUESTIONS.md` with the exact schema/endpoint you'd need, and move to the next task. Do not add it yourself, even if it looks small and safe.
- **No hardcoded credentials, ever, including as a "fallback."** If an env var is missing, throw or log a clear error. A silent substitution is worse than a visible failure.
- **When you replace a technique, delete the old one in the same commit.** Two systems solving the same visual problem is itself a bug, independent of whether either one works.
- **Don't label something "Cinematic" or "Realistic" unless the geometry is actually different from the baseline.** If two view modes render the same mesh, they're one mode with two camera presets — name it that.
- **Real checkpoints, not in-prompt pauses.** I will send you these five tasks one at a time, as separate messages. Do not start Task N+1 until I've sent a message saying to. If you're running in an autonomous/Auto mode that doesn't naturally stop, treat "wait for the next message" as the literal last line of every task's instructions.
- **No stubs.** If a comment would say "// add X later," either add X now or don't write the comment — flag the gap in `OPEN_QUESTIONS.md` instead.

---

## Task 1 — Consolidate the map to one 3D technique

**File:** `frontend/src/components/MapWidget.jsx` (currently 1006 lines)

**Confirmed state:** three systems currently coexist —
- a native Mapbox `fill-extrusion` layer (~line 259 and ~line 321) — this part works and is the right approach, keep it
- a `.cube-marker` CSS block (~line 383–388) and its DOM marker creation (~line 580, 605) — this is exactly what the prior fix-prompt said to delete, and it wasn't
- a custom Three.js scaling system keyed off `child.userData.meterScale` (~line 526–574), whose relationship to the two systems above is unclear from the code alone

**Do:**
1. Confirm which of these three actually renders the visible 3D buildings today (check in a running dev build, not just by reading).
2. Keep the native `fill-extrusion` layer for the map-overview state (unzoomed) — it's already correct for that job and needs no library.
3. Delete `.cube-marker` and everything that creates/positions it. Delete the `userData.meterScale` scaling system unless you find it's doing something the extrusion layer can't (state that finding in your proof if so, don't just leave it in "to be safe").
4. Re-test popup positioning after the cleanup — the original "popups disproportionate & appear within map" complaint may have been caused by these systems fighting each other, not by the popup code itself.

**Proof required:** `grep -rn "cube-marker" frontend/src` returns nothing; screenshot of the overview map state; confirmation of which single system now owns the 3D visuals.

---

## Task 2 — Replace procedural boxes with real building models

**File:** `frontend/src/components/BuildingPreview3D.jsx`

**Confirmed state:** `Unit3DBlock` renders a `boxGeometry(1.4, 1.0, 1.4)` per unit with one flat emissive "window" plane. Both `viewMode === 'image'` and `viewMode === 'interactive'` branches call the exact same component with the exact same geometry — the only difference is `OrbitControls` settings and starting camera position. There is no roof, no facade, no building envelope in either mode. This is the direct, confirmed cause of "just blocks."

**Do:**
1. Stop hand-generating geometry from primitives. Load real low-poly building models via `@react-three/drei`'s `useGLTF` (already a dependency — no install needed):
   ```jsx
   import { useGLTF } from '@react-three/drei';
   const { scene } = useGLTF('/models/building-medium.glb');
   ```
2. Prepare 3–4 `.glb` models tiered by unit count (small/medium/large/tower), matching the massing and roofline style of the reference renders (pitched roof, balcony rails, ground-floor entry) — not photorealistic, just an actual building silhouette instead of a cube.
   - **[Open decision — see end of doc]** where these models come from.
   - Run them through `gltf-transform` with Draco compression before committing. The repo's JS bundle is already 3.89MB; an uncompressed model can add tens of MB on its own.
3. Wrap loading in `<Suspense fallback={...}>` with a real loading state, not a blank frame.
4. Tint/accent the loaded model by occupancy (e.g. an emissive rim or a subtle color wash) rather than recoloring the whole mesh — real buildings don't turn solid red.
5. `viewMode === 'interactive'` can stay as a genuinely lighter-weight fallback (e.g. the current box grid, useful for very low-end devices) — but rename its label to something honest like "Simple View," not "Interactive Blocks" implying it's the lesser option by design, since right now nothing distinguishes the two except a name.
6. Keep the existing unit-position-from-`unit_number` logic (floor/column parsed from the real unit number) — that part is genuinely good, data-driven work. Don't replace it with anything randomized.

**Proof required:** screenshot of a real property showing an actual building shape (roof + walls + windows as a coherent form, not a bar-chart of cubes), in both themes; confirm bundle size impact via `npm run build`.

---

## Task 3 — Fix the unit popup to show what was actually asked for

**File:** `frontend/src/components/UnitDetailPopup.jsx`

**Confirmed state:** when `unit.images.length > 0`, the component renders a plain green `boxGeometry` with edge highlighting — the unit's actual photo URLs are checked for existence but never rendered anywhere. When there are no images, it renders almost the same box, recolored, with a "No Images Uploaded" label. Neither branch shows a photo or a floor plan.

**Do:**
1. When `unit.images.length > 0`: render the actual photos (a simple thumbnail grid or carousel is sufficient — this alone resolves most of the gap and is far cheaper than a procedural floor plan). Pull the same category structure already implied by the reference design (bedroom/bathroom/kitchen/balcony/etc.) if that data exists on the unit object; if it doesn't, a plain grid of whatever images exist is still correct — don't invent categories that aren't in the data.
2. Pair the photos with **one** shared low-poly "generic unit shell" model from Task 2's asset set (picked by bedroom count, not generated per-unit) for the 3D panel — not a per-unit procedural box.
3. When there are zero images: keep the current explicit empty state — the "No Images Uploaded" text treatment already does what was asked. Don't touch this branch.

**Proof required:** screenshot of a unit with real uploaded photos showing those actual photos, and a unit with none showing the existing empty state, side by side.

---

## Task 4 — Remove the hardcoded Mapbox token

**File:** `frontend/src/lib/api.js`, function `geocodeAddress` (~line 257–259)

**Confirmed state:** a working Mapbox public token is hardcoded as a fallback, split into two string literals and concatenated, used whenever `VITE_MAPBOX_TOKEN` isn't set. `README.md` already documents `VITE_MAPBOX_TOKEN` as the correct env var — this fallback has no legitimate reason to exist.

**Do:**
1. Delete the hardcoded fallback entirely. If `VITE_MAPBOX_TOKEN` is missing, `geocodeAddress` should throw a clear, descriptive error — not substitute a real key silently.
2. Separately, **rotate that Mapbox token in your account regardless of this code fix** — it's already been pushed to a public remote, so removing it from new commits doesn't remove it from git history.

**Proof required:** the diff showing the fallback removed; confirmation (from you, not the agent) that the token has been rotated.

---

## Task 5 — Bundle size

**Confirmed state:** a real `npm run build` on this repo produces a main chunk of **3.89MB minified / 1.07MB gzipped**, with Vite's own build output warning about chunks over 1000kB. Most pages and the map/3D code appear to ship in that one chunk rather than being route-split.

**Do:**
1. Route-level code splitting via `React.lazy()` for the page components — Admin/Landlord/Tenant/Agent dashboards shouldn't all ship in one bundle when a tenant only ever needs their own portal.
2. Confirm `MapWidget`, `BuildingPreview3D`, and the Voxel3D components are only downloaded on routes that actually render them.
3. Fix the Lenis dynamic-vs-static double-import Vite already flagged (`AppShell.tsx` dynamically imports it, `App.jsx` statically imports it — pick one).

**Proof required:** before/after `npm run build` output showing the main chunk size drop.

---

## Found while reading the code, not part of this pass — flagging only

- `backend/utils/security.js`, `getAdminPassword()`: falls back to a default admin password with a console warning when `ADMIN_HARDCODED_PASSWORD`/`ADMIN_PASSWORD` isn't set in the environment. If this is reachable in production, it's a real vulnerability, unrelated to the UI work. Worth its own dedicated pass — say the word and I'll scope that separately.
- `npm audit` currently reports 1 critical and 1 high severity dependency vulnerability.
- I didn't chase either of these further since they're outside what you asked me to fix here.

## What's already working — leave it alone

- `ChatAssistant.jsx`: "Mutune AI" branding, `VoxelLogo3D` spinning on load with status text. This matches the ask.
- `backend/routes/ai.js` role-aware context for landlord/agent — legitimate, well-scoped, keep it.

---

## Open decisions before Task 2 starts

1. **Building model source:** free CC0/CC-BY low-poly packs (Kenney, Poly Pizza, Quaternius — fast, generic look) vs. a handful of custom models matching your exact reference aesthetic (slower, on-brand, costs design time/money)?
2. **Task 5 timing:** now, alongside the visual fixes, or after — since it touches routing broadly and could make review noisier?
3. Want Section "Found while reading the code" turned into a real follow-up task now, or later?
