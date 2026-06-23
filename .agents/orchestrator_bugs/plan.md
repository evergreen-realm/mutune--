# Plan - MutuneRent Pro Bugs Resolution

This plan decomposes the 13 requirements (R1 through R13) from the user's follow-up request.

## Decomposition
To manage complexity and context window constraints, the work is split into the following milestones:

- **Milestone 1: Codebase Exploration & UI Mockup/Research (R12)**
  - Dispatch Explorer agent to analyze all 11 bugs/features (R1 to R11).
  - Propose exact files, line numbers, and changes needed.
  - Review design system guidelines (MASTER.md) and produce visual mockup/prototype recommendations.
  - Output: `exploration_report.md` with detailed code changes plan.

- **Milestone 2: UI, Theme, Layout & Navigation (R1, R2, R3, R4, R11)**
  - Adjust margins, padding, and layout widths. Remove double margins.
  - Fix light mode text contrast/readability.
  - Implement functional search triggers.
  - Add notification clear/dismiss functionality.
  - Implement premium, animated toast/pop-up notifications.
  - Output: Verified layout and interactive UI components.

- **Milestone 3: Backend Logic, Inventory & Tenant Registry (R5, R6, R7)**
  - Fix Admin Inventory Item addition 500 internal server error.
  - Fix Tenant Rent amount update errors in the admin portal.
  - Fully implement Late Fee rules addition (remove stubs).
  - Display unique Tenant ID/Code in the admin user registry.
  - Output: Functional database mutations and validated backend routes.

- **Milestone 4: Property Registry, Units & Media Upload (R8, R9)**
  - Fix S3/R2 drag-and-drop credential validation error.
  - Implement multi-unit property setup with "+ Add Unit" details mapping.
  - Output: Configurable properties and functional file uploads.

- **Milestone 5: Interactive Chat Assistant Redesign (R10)**
  - Premium UI redesign of ChatAssistant with micro-interactions, responsive styling, and proper animations.
  - Ensure typed characters in the chat input are highly visible and readable.
  - Output: Premium animated ChatAssistant component.

- **Milestone 6: Integration, E2E Testing & Integrity Audit (R13)**
  - Ensure all features connect to the backend (no stubs/TODOs).
  - Compile the production build (`npm run build`).
  - Run regression test suite.
  - Execute Forensic Auditor checks.
  - Output: Clean victory report.

## Verification Protocol
For each milestone:
1. Worker implements changes and reports build/test status.
2. Reviewers independently check the code changes.
3. Challengers run targeted tests.
4. Forensic Auditor verifies integrity.
