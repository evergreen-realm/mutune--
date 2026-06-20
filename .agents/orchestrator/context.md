# Project Context: MutuneRent Pro Frontend Redesign

## Tech Stack
- **Frontend**: React (v18.3.1) + Vite + Tailwind CSS + Framer Motion (v12.40.0) + Recharts + TanStack React Query + Clerk Auth
- **Backend**: Node.js Express API server + MongoDB (Mongoose models)

## Core Files to Modify
- `frontend/tailwind.config.js`: Tailwind theme options
- `frontend/src/index.css`: Global styles & CSS variables
- `frontend/src/App.jsx`: Central routing, layouts, and page transitions
- `frontend/src/pages/`: Page components to redesign
- `frontend/src/components/`: Layout and reusable components to redesign/create

## Redesign Style Direction
- **Swiss Editorial Layout**: Strong typography hierarchy (Inter font), grid alignments, clean borders, high contrast.
- **Color Palette**: Professional blue accent (`#2563EB`) as primary. Green is reserved strictly for success/positive statuses. Backgrounds: light `#F8FAFC`, dark `#0F172A`.
- **Animations**: Framer Motion transitions for sidebars, lists, page loading, wizards, and floating panels.
