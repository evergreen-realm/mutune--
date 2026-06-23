## 2026-06-21T16:26:31Z
You are a teamwork_preview_worker.
Your working directory is: c:\Users\Admin\Desktop\mutune\.agents\teamwork_preview_worker_bugs_m4
Your role is: Property & Media Upload Specialist

Touch the following files and implement the requested changes:
1. `backend/utils/r2.js`:
   - Implement lazy loading for the `S3Client` instantiation to resolve the `Error: Resolved credential object is not valid` error on import.
   - Use a getter function `getR2Client()` to initialize the client only when `uploadImage` or `deleteImage` are called.
   - Export compatibility getters so existing imports of `r2` still work.
2. `backend/models/Property.js`:
   - Expand `unitSchema` to include missing fields: `bathrooms`, `floor`, `size_sqft`, `size_sqm`, `unit_type`.
   - Expand `propertySchema.type` enum to match all types: `'apartment'`, `'single_family'`, `'commercial'`, `'mixed_use'`, `'bedsitter'`, `'studio'`, `'house'`, `'single'`.
3. `backend/routes/properties.js`:
   - Update role permissions on `POST /properties/:id/units` to allow `'agent'` and `'landlord'` (in addition to admin/super_admin).
   - In unit addition controller, map all fields correctly: `bedrooms`, `bathrooms`, `floor`, `size_sqft`, `size_sqm`, `unit_type` (which may be passed as `type`).
4. `frontend/src/pages/AddPropertyPage.jsx`:
   - Update `validateStep` to ensure all units have valid positive rents.
   - Ensure choosing units and adding configurations works correctly.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run builds to verify compile correctness. Write a summary of your changes to handoff.md in your directory.
