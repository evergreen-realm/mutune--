# Handoff Report — Property Platform Bug Investigation (M1.3)

This handoff report summarizes the findings of the read-only investigation into Media Upload (R8), Property Unit Setup (R9), and Chat UX (R10) features.

---

## 1. Observation

### R8: Drag-and-Drop file upload credential issues
- **File**: `backend/utils/r2.js`
- **Lines 11-18**:
  ```javascript
  const r2 = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    }
  });
  ```
- **File**: `backend/routes/upload.js`
- **Line 8**: `const { uploadImage } = require('../utils/r2');`
- **Error Verbose**: `Error: Resolved credential object is not valid` occurs during module load or test runs when environment variables are uninitialized/mocked.

### R9: Property unit configuration & '+ Add Unit' functionality
- **File**: `backend/models/Property.js` (`unitSchema`, lines 3-15):
  ```javascript
  const unitSchema = new mongoose.Schema({
    unit_number: { type: String, required: true },
    unit_type: String,
    bedrooms: Number,
    rent_kes: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['vacant', 'occupied', 'maintenance', 'notice_issued'], default: 'vacant' },
    current_tenant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    lock_status: { type: String, enum: ['unlocked', 'pending_viewing', 'viewed_unlocked', 'payment_confirmed', 'locked'], default: 'unlocked' },
    unit_geolocation: {
      type:        { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined }  // [longitude, latitude]
    }
  }, { _id: true });
  ```
- **File**: `backend/models/Property.js` (`propertySchema.type`, line 42):
  ```javascript
  type: { type: String, enum: ['apartment', 'single_family', 'commercial', 'mixed_use'], required: true },
  ```
- **File**: `backend/routes/properties.js` (line 333):
  ```javascript
  router.post('/:id/units',
    requireAuth,
    requireRole(['admin', 'super_admin']),
  ```
- **File**: `frontend/src/pages/AddPropertyPage.jsx` (lines 397-407):
  ```javascript
        await addUnit(propertyId, {
          unit_number: unit.unit_number.trim(),
          type: unit.type,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          rent_kes: Number(unit.rent_kes) || 0,
          floor: unit.floor,
          size_sqft: unit.size_sqft ? Number(unit.size_sqft) : undefined,
        });
  ```
- **File**: `backend/routes/properties.js` (lines 350-358):
  ```javascript
        property.units.push({
          unit_number: req.body.unit_number,
          rent_kes: req.body.rent_kes,
          bedrooms: req.body.bedrooms || 1,
          bathrooms: req.body.bathrooms || 1,
          size_sqm: req.body.size_sqm,
          status: 'vacant',
          lock_status: 'unlocked'
        });
  ```

### R10: Premium ChatAssistant UI/UX redesign
- **File**: `frontend/src/components/ChatAssistant.jsx` (lines 115-117):
  ```jsx
        {isOpen && (
          <div className="w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-fade-in">
  ```
- **File**: `frontend/src/components/ChatAssistant.jsx` (line 125):
  ```jsx
                  <p className="text-xs text-slate-400 mt-0.5">Property Assistant</p>
  ```
- **File**: `frontend/src/components/ChatAssistant.jsx` (lines 184-190):
  ```jsx
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-green-600 text-white rounded-tr-none'
                        : msg.isError
                          ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-none'
                          : 'bg-gray-100 text-gray-800 rounded-tl-none'
                    }`}
  ```

---

## 2. Logic Chain

- **R8 Credential Crash**:
  - `backend/utils/r2.js` immediately constructs `new S3Client` using environment variables.
  - In certain contexts (e.g. initial loads, tests running without specific setup, or files imported before `dotenv.config()`), `process.env.CLOUDFLARE_R2_ACCESS_KEY_ID` is `undefined`.
  - AWS SDK v3's `S3Client` validates credentials on instantiation. Since the credentials object contains `undefined` values, it throws the fatal `Resolved credential object is not valid` error immediately, causing imports of `upload.js` or `pdf.js` to crash the process.
  - **Conclusion**: Wrapping client instantiation in a lazy getter function `getR2Client()` deferring creation to function invocation fixes this issue.

- **R9 Setup Discrepancies**:
  - `unitSchema` lacks fields (`bathrooms`, `floor`, `size_sqft`, `size_sqm`). Any data passed under these names is dropped by Mongoose on `save()`.
  - The property type `'bedsitter'` and `'studio'` are valid on the frontend and the express-validators but are missing from `propertySchema.type` enum, causing Mongoose schema validation failure on save.
  - The `POST /properties/:id/units` endpoint is restricted to admins only (`['admin', 'super_admin']`), yet `AddPropertyPage.jsx` allows agents and landlords to register properties, resulting in a `403 Forbidden` error when trying to add units.
  - **Conclusion**: Updating the schema fields, expanding the property type enum, and adjusting the route's `requireRole` and parameter mapping will resolve the discrepancies.

- **R10 ChatAssistant UX**:
  - The chat window mounts conditionally via `{isOpen && ...}`. When closed, it instantly unmounts, resulting in no exit animation.
  - White text on `bg-green-600` has a contrast ratio of ~4.45:1, which is below the WCAG 4.5:1 ratio. `text-slate-400` on `bg-slate-900` has a contrast ratio of ~3.3:1.
  - Lack of `dark:` classes makes the chat widget incompatible with dark mode.
  - **Conclusion**: Keeping the component mounted with a visual transform/opacity toggle, altering color styles to higher contrast (e.g., `bg-emerald-700` and `text-slate-300`), and adding dark mode classes provides a premium, compliant redesign.

---

## 3. Caveats

- We assume that the application uses a standard Tailwind configuration with default colors (like `slate`, `emerald`, `green`).
- We assume that Clerk is used for frontend authentication, which injects `window.Clerk` for token authorization headers.
- The lazy S3Client requires that the first file upload or deletion occurs after environment variables are loaded, which is guaranteed by `dotenv` running on line 1 of `server.js`.

---

## 4. Conclusion

- **R8**: Instantiate `S3Client` lazily in `backend/utils/r2.js` via a `getR2Client()` getter function.
- **R9**: Add `bathrooms`, `floor`, `size_sqft`, and `size_sqm` fields to Mongoose `unitSchema` in `backend/models/Property.js`. Update `requireRole` on the `/properties/:id/units` route to allow agents and landlords, and map the missing payload fields.
- **R10**: Restructure `ChatAssistant.jsx` to animate opacity/scale/translate using Tailwind transitions instead of conditional rendering, and apply WCAG-compliant colors and dark mode classes.

---

## 5. Verification Method

- **Unit/Integration Tests**: Run the backend test suites using:
  ```powershell
  npm run test
  ```
  Ensure all tests under `backend/tests/` (including `tier3_4.e2e.test.js`) pass without credential errors.
- **Verification of files**: Inspect `exploration_report.md` for the exact line numbers and code adjustments.
