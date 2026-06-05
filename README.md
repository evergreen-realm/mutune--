# MutuneRent Pro

Property management system for Mutune Estate Agency, Mombasa, Kenya. Designed to scale from 600+ properties to 2,000+ properties within two years.

## Project Structure
- `backend/` - Node.js/Express API with MongoDB/Mongoose
- `frontend/` - React 18 + Vite SPA styled with Tailwind CSS

## Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- MongoDB Instance (or MongoDB Atlas M0 cluster)

## Quick Start

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (copy `.env.example` to `.env` and fill in credentials):
   ```bash
   cp .env.example .env
   ```
4. Run in development mode:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables List

### Backend (`backend/.env`)
- `PORT` - The port on which the Express server runs (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `FRONTEND_URL` - URL of the React frontend
- `CLERK_PUBLISHABLE_KEY` - Public Clerk key for authentication
- `CLERK_SECRET_KEY` - Secret Clerk key for API validation
- `MPESA_CONSUMER_KEY` - Safaricom Daraja Consumer Key
- `MPESA_CONSUMER_SECRET` - Safaricom Daraja Consumer Secret
- `MPESA_PASSKEY` - Safaricom Daraja Online Passkey
- `MPESA_SHORTCODE` - Safaricom Paybill/BuyGoods shortcode (Sandbox: 174379)
- `MPESA_CALLBACK_URL` - Webhook URL for M-Pesa transaction results
- `MPESA_ENV` - Environment (`sandbox` or `production`)
- `AT_API_KEY` - Africa's Talking SMS API Key
- `AT_USERNAME` - Africa's Talking SMS Username (`sandbox` or custom)
- `AT_FROM` - Registered sender ID for SMS (e.g. `MutuneRent`)
- `CLOUDFLARE_R2_ENDPOINT` - S3-compatible API endpoint for Cloudflare R2
- `CLOUDFLARE_R2_ACCESS_KEY_ID` - Cloudflare API token key ID
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` - Cloudflare API token secret key
- `CLOUDFLARE_R2_BUCKET` - Cloudflare R2 bucket name
- `SENTRY_DSN` - Sentry instrumentation client key
- `GROQ_API_KEY` - Groq Cloud API Key
- `JWT_SECRET` - JWT signing secret for sessions
- `ENCRYPTION_KEY` - 32-byte hexadecimal key for field-level encryption

### Frontend (`frontend/.env`)
- `VITE_API_URL` - Base backend API URL (e.g., `http://localhost:3000/api/v1`)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk Publishable Key for React integration
- `VITE_SENTRY_DSN` - Sentry DSN key for frontend monitoring
- `VITE_MAP_TILE_URL` - Leaflet maps tile URL pattern (default uses OpenStreetMap)
