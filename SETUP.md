# PropAI — Setup Guide

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, React Router v6
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **AI**: Claude API (photo classification, check reading, lease parsing)
- **Banking**: Plaid (bank account linking + ACH)
- **E-Signatures**: DocuSign (lease renewals)
- **Notifications**: Nodemailer (email) + Twilio (SMS)

---

## Prerequisites
- Node.js 18+
- PostgreSQL (local or hosted — Neon, Supabase, Railway all work)

---

## Step 1 — Database

### Option A: Local PostgreSQL
```bash
createdb propai
```

### Option B: Free hosted (recommended for getting started)
- [Neon.tech](https://neon.tech) — free tier, instant setup
- Copy the connection string they give you

---

## Step 2 — API Keys

### Required
| Service | Where to get it | Notes |
|---------|----------------|-------|
| **Anthropic (Claude)** | [console.anthropic.com](https://console.anthropic.com) | Powers check reading, maintenance photo classification, lease parsing |

### Required for payments
| Service | Where to get it | Notes |
|---------|----------------|-------|
| **Plaid** | [dashboard.plaid.com](https://dashboard.plaid.com) | Use sandbox mode for testing — free |

### Optional (but recommended)
| Service | Where to get it | Notes |
|---------|----------------|-------|
| **DocuSign** | [developers.docusign.com](https://developers.docusign.com) | Lease renewal e-signatures — has free developer sandbox |
| **Gmail (SMTP)** | Create an App Password in Google Account settings | Email notifications |
| **Twilio** | [console.twilio.com](https://console.twilio.com) | SMS notifications — has free trial |

---

## Step 3 — Backend Setup

```bash
cd propai/backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your values
# At minimum you need: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY

# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Start the backend server
npm run dev
```

The backend runs on `http://localhost:5000`

---

## Step 4 — Frontend Setup

```bash
cd propai/frontend

# Install dependencies
npm install

# Start the frontend dev server
npm run dev
```

The frontend runs on `http://localhost:3000`

---

## Step 5 — Create Your First Account

1. Open `http://localhost:3000`
2. Click **Create Account**
3. Select **Property Manager**
4. Fill in your details and register

Then from the Manager portal:
1. Go to **Properties** → Add your first property and units
2. Go to **Vendors** → Add your preferred contractors (set Auto-Dispatch = ON for hands-free routing)
3. Go to **Leases** → Create Lease (after inviting a tenant)
4. Invite a tenant: `POST /api/auth/invite-tenant` with their email and unitId

---

## How the AI Features Work

### Maintenance Photo Classification
When a tenant submits a maintenance request with a photo, the backend sends the image to Claude Vision which:
- Identifies the trade needed (Plumbing, Electrical, HVAC, Appliance Repair, etc.)
- Generates a summary of the issue
- Sets a priority level (LOW / NORMAL / HIGH / EMERGENCY)
- If a vendor with `autoDispatch: true` is found matching the trade, they are automatically notified via email + SMS

### Check Reading
When a tenant uploads check front + back:
- Claude Vision reads the check MICR line (routing/account numbers)
- Extracts payee, payer, amount, date
- Creates a payment record with the extracted data visible to the manager

### Lease Parsing
When a manager uploads a lease document (PDF/image):
- Claude Vision extracts: rent amount, dates, deposit, late fees, utilities, key clauses
- Manager can review and the data is stored with the lease record

---

## Plaid Sandbox Testing

In sandbox mode you can use these test credentials:
- **Username**: `user_good`
- **Password**: `pass_good`
- **Institution**: Search for "First Platypus Bank" or similar sandbox bank

---

## Production Deployment

### Environment changes for production:
```
NODE_ENV=production
PLAID_ENV=production          # Change from sandbox
DOCUSIGN_BASE_URL=https://na3.docusign.net/restapi   # Production URL
STORAGE_DRIVER=s3             # Switch to S3 for file storage
```

### Recommended hosting:
- **Frontend**: Vercel or Netlify (free tier)
- **Backend**: Railway, Render, or Fly.io
- **Database**: Neon (PostgreSQL) or PlanetScale

---

## File Structure

```
propai/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── manager/          # Dashboard, Properties, Leases, Maintenance, Vendors, Finances
│       │   └── tenant/           # Home, RentPayment, MaintenanceRequest, LeaseDetails
│       ├── components/           # ManagerLayout, TenantLayout
│       ├── context/AuthContext   # JWT auth state
│       └── api/client.js         # Axios with auth interceptor
└── backend/
    ├── prisma/schema.prisma      # Full data model
    └── src/
        ├── routes/               # auth, properties, leases, payments, maintenance, vendors, dashboard
        ├── services/
        │   ├── ai.service.js     # Claude API calls
        │   ├── plaid.service.js  # Bank linking + ACH
        │   ├── docusign.service.js
        │   └── notifications.service.js
        └── middleware/           # JWT auth, file upload
```
