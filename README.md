# MutuneRent Pro 🏢

> Full-stack property management platform for Mutune Estate Agency, Mombasa, Kenya.  
> Designed to scale from 600+ to 2,000+ properties.

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://mutunerent-web-mishael-s-alpha.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://mutunerent-api.onrender.com)
[![License](https://img.shields.io/badge/license-Private-red)](#)

---

## 🌐 Live URLs

| Service | URL |
|---------|-----|
| **Frontend (Vercel)** | https://mutunerent-web-mishael-s-alpha.vercel.app |
| **Backend API (Render)** | https://mutunerent-api.onrender.com/api/v1 |
| **Health Check** | https://mutunerent-api.onrender.com/api/v1/health |

---

## 📁 Repository Structure

```
mutune/
├── backend/                    # Node.js / Express API
│   ├── config/                 # Database connection (MongoDB Atlas)
│   ├── cron/                   # Scheduled jobs (late fees, lease cleanup)
│   ├── middleware/             # Auth (JWT), RBAC, sanitize, security
│   ├── models/                 # Mongoose schemas
│   ├── routes/                 # REST API route handlers
│   ├── services/               # External integrations (M-Pesa, SMS, email, AI)
│   ├── tests/                  # E2E and unit tests (Jest + Supertest)
│   ├── utils/                  # Helpers (logger, R2 uploads, security)
│   ├── server.js               # Express entry point
│   ├── package.json
│   └── .env.example            # Environment variable template
│
├── frontend/                   # React 18 + Vite SPA
│   ├── public/
│   │   └── assets/             # Images, icons, prototype references
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── MapWidget.jsx          # Mapbox GL + Esri satellite map
│   │   │   ├── BuildingPreview3D.jsx  # Three.js 3D building viewer
│   │   │   ├── ChatAssistant.jsx      # AI chat assistant (Groq)
│   │   │   ├── ImageUpload.jsx        # Drag & drop + camera photo upload
│   │   │   └── ui/                    # Generic Button, Card, Badge components
│   │   ├── pages/              # Role-specific page views
│   │   │   ├── LoginPage.jsx
│   │   │   ├── OnboardingPage.jsx
│   │   │   ├── AdminDashboardPage.jsx
│   │   │   ├── LandlordDashboardPage.jsx
│   │   │   ├── TenantPortalPage.jsx
│   │   │   ├── AgentPerformancePage.jsx
│   │   │   ├── MaintenancePage.jsx
│   │   │   ├── PaymentsPage.jsx
│   │   │   ├── PropertyDetailPage.jsx
│   │   │   ├── TenantsPage.jsx
│   │   │   └── TasksPage.jsx
│   │   ├── lib/
│   │   │   └── api.js          # Axios API client with all endpoint calls
│   │   ├── store/
│   │   │   └── themeStore.js   # Zustand global theme (light/dark)
│   │   ├── App.jsx             # Router + role-based route guard
│   │   └── index.css           # Global CSS design system (Tailwind + tokens)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   ├── .env.example            # Frontend env template
│   └── .env.production         # Production env (Vercel injects at build time)
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI: lint + test on every PR
│       └── deploy.yml          # CD: auto-deploy on push to main
│
├── render.yaml                 # Render Blueprint (backend infra-as-code)
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- MongoDB Atlas cluster (or local MongoDB)

### 1. Clone the Repo

```bash
git clone https://github.com/evergreen-realm/mutune--.git
cd mutune--
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env        # Fill in your secrets
npm run dev                 # Starts on http://localhost:10000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env        # Set VITE_API_URL=http://localhost:10000/api/v1
npm run dev                 # Starts on http://localhost:5173
```

---

## 🏗️ Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | MongoDB Atlas + Mongoose 8 |
| Auth | JWT (custom) |
| Payments | M-Pesa Daraja API (STK Push) |
| SMS | Africa's Talking |
| Email | Resend |
| AI Chat | Groq (LLaMA 3.3 70B) |
| File Storage | Cloudflare R2 (S3-compatible) |
| PDF Reports | PDFKit |
| Hosting | Render (Frankfurt) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 + custom CSS tokens |
| State | Zustand + TanStack Query |
| Maps | Mapbox GL JS + Esri World Imagery (satellite) |
| 3D | Three.js + React Three Fiber |
| Charts | Recharts |
| Animations | Framer Motion + GSAP |
| Hosting | Vercel |

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
PORT=10000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://...

# Auth
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=32_byte_hex_key_here

# M-Pesa (Safaricom Daraja)
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=174379
MPESA_ENV=sandbox
MPESA_CALLBACK_URL=https://your-api.onrender.com/api/v1/payments/mpesa/callback

# Africa's Talking (SMS)
AFRICAS_TALKING_API_KEY=
AFRICAS_TALKING_USERNAME=sandbox
AFRICAS_TALKING_SMS_FROM=MutuneRent

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev

# AI (Groq)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Cloudflare R2 (File storage)
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=mutune
CLOUDFLARE_R2_PUBLIC_URL=

# Frontend URL (CORS)
FRONTEND_URL=https://mutunerent-web-mishael-s-alpha.vercel.app
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=https://mutunerent-api.onrender.com/api/v1
VITE_MAPBOX_TOKEN=your_mapbox_public_token
```

---

## 👥 User Roles

| Role | Description | Dashboard |
|------|-------------|-----------|
| **Admin** | Full platform control, approves users & properties | `/admin` |
| **Landlord** | Manages their properties, views payments | `/landlord` |
| **Agent** | Lists properties, tracks commissions | `/agent` |
| **Tenant** | Pays rent, raises maintenance tickets | `/tenant` |

### Registration Workflow
```
User signs up → Role selected → Admin reviews → Approved → Access granted
```

---

## 🗺️ Key Features

- **🛰 Satellite Map** — Esri World Imagery free high-res tiles (on par with Google Maps satellite) with Mapbox GL 3D building extrusions
- **📸 Photo Uploads** — Drag-and-drop + mobile camera capture for properties and maintenance tickets  
- **💳 M-Pesa Integration** — STK Push payments directly from tenant portal  
- **🤖 AI Chat Assistant** — Groq-powered context-aware chat for all roles  
- **📊 Analytics Dashboards** — Role-specific KPI charts, occupancy rings, payment logs  
- **🌗 Light / Dark Mode** — System-aware theme with manual toggle  
- **📄 KRA PDF Reports** — Auto-generated tax reports for admin  
- **🔔 Notifications** — Real-time in-app notification feed  

---

## 🚢 Deployment

### Frontend → Vercel

Push to `main` branch triggers automatic Vercel deployment.

Manual deploy:
```bash
cd frontend
npm run build         # Builds to frontend/dist/
vercel --prod         # Deploy dist/ to Vercel
```

### Backend → Render

The `render.yaml` file at the repo root is a Render Blueprint.  
Push to `main` triggers automatic Render deployment.

Manual trigger: Render Dashboard → Manual Deploy.

---

## 🧪 Tests

```bash
# Backend tests (Jest + Supertest)
cd backend && npm test

# Frontend tests (Vitest)
cd frontend && npm test
```

---

## 📝 License

Private — Mutune Estate Agency. All rights reserved.
