## 2026-06-21T16:26:30Z
You are a teamwork_preview_worker.
Your working directory is: c:\Users\Admin\Desktop\mutune\.agents\teamwork_preview_worker_bugs_m2
Your role is: UI/Layout, Theme & Navigation Specialist

Touch the following files and implement the requested changes:
1. `frontend/src/pages/TenantPortalPage.jsx`:
   - Remove `min-h-screen`, `bg-background`, and `p-6` from the inner wrapper elements inside `PortalSkeleton` (line 52), profile screen (line 275), and pending approval screen (line 368).
   - Remove the custom duplicate `<header>` component (lines 482-514) that creates a double topbar.
   - Add exit animations to the Arrears Warning banner.
2. `frontend/src/layouts/AppShell.tsx`:
   - Remove the redundant nested `div` wrapping the topbar/main content (line 101).
3. `frontend/src/index.css`:
   - Update `--muted` in light mode to `#475569` for contrast.
   - Define a proper `.animate-fade-in` utility class with entry scale transition:
     ```css
     @layer utilities {
       .animate-fade-in {
         animation: fadeIn 0.2s ease-out forwards;
       }
     }
     @keyframes fadeIn {
       from { opacity: 0; transform: scale(0.95); }
       to { opacity: 1; transform: scale(1); }
     }
     ```
4. Light Mode contrast enhancements:
   - In components/ui/Card.jsx, components/ui/Input.jsx, components/ui/Select.jsx, components/ui/Modal.jsx, components/ui/DataTable.jsx, and components/ui/EmptyState.jsx, replace text-gray-400/text-gray-300 with higher contrast colors (e.g., text-gray-500/text-gray-600) to pass WCAG AA contrast guidelines.
5. `frontend/src/layouts/Topbar.tsx`:
   - Remove `readOnly` and `cursor-default` from the search bar, bind it to a state query.
   - Add a dismiss/clear button (such as an `<X>` icon or button) next to individual notifications in the notifications popover.
   - Wrap dropdown/popover elements in `<AnimatePresence>` for smooth entry and exit transitions.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run builds to verify compile correctness. Write a summary of your changes to handoff.md in your directory.
