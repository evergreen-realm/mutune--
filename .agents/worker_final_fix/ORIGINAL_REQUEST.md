## 2026-06-22T07:03:23Z
You are a teamwork_preview_worker.
Your working directory is: c:\Users\Admin\Desktop\mutune\.agents\worker_final_fix

Tasks:
1. Touch `frontend/src/pages/AddPropertyPage.jsx` and update `validateStep` to ensure that on step 1 of unit configuration, validation checks that rent amount is present and greater than 0:
   ```javascript
   const emptyNum = form.units.find(u => !u.unit_number?.trim());
   if (emptyNum) { toast.error('Every unit must have a unit number'); return false; }
   const invalidRent = form.units.find(u => !u.rent_kes || Number(u.rent_kes) <= 0);
   if (invalidRent) { toast.error('Every unit must have a valid rent amount greater than 0'); return false; }
   ```
2. Run backend tests to ensure everything is correct and passing. If there are any errors, fix them.
3. Run `npm run build` in the `frontend/` directory to verify compiling works.
4. Report status.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Send a status update message when done.
