# PropFlow Deployment Guide — Railway

## Step 1: Deploy Backend

1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select the `propai/backend` root directory
3. Add ALL these environment variables in Railway → Variables:

```
DATABASE_URL=postgresql://neondb_owner:...@ep-green-pine-ajr2tn6i-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=<generate a 64-char random string — use: openssl rand -hex 32>
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://propflow.up.railway.app

ANTHROPIC_API_KEY=sk-ant-api03-...

PLAID_CLIENT_ID=6a3f12a0599631000e6be87d
PLAID_SECRET=1cbc5c73038a6c7b4f7444451b5abb
PLAID_ENV=sandbox

STRIPE_SECRET_KEY=sk_live_...       ← get from stripe.com/dashboard
STRIPE_PUBLISHABLE_KEY=pk_live_...  ← get from stripe.com/dashboard
STRIPE_WEBHOOK_SECRET=whsec_...     ← add after step 3

DOCUSIGN_INTEGRATION_KEY=190bbbd7-e5b5-421c-b07e-8ff868923e44
DOCUSIGN_USER_ID=f874059b-bdfa-4bca-b607-1eb40e857627
DOCUSIGN_ACCOUNT_ID=da903ec8-efee-4f95-bd4c-2d4b0ccb63da
DOCUSIGN_PRIVATE_KEY_PATH=./docusign_private.key
DOCUSIGN_BASE_URL=https://demo.docusign.net/restapi

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=mddnnbr@gmail.com
SMTP_PASS=liff fmxn mujj yjld
EMAIL_FROM=PropFlow <mddnnbr@gmail.com>

TWILIO_ACCOUNT_SID=ACxxxxxxx   ← optional, for SMS
TWILIO_AUTH_TOKEN=xxx
TWILIO_FROM_NUMBER=+15551234567

STORAGE_DRIVER=local   ← switch to "s3" when you add S3 keys
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=propflow-uploads

RENTCAST_API_KEY=
ACCOUNT_TIER=GROWTH
OPS_EMAIL=mddnnbr@gmail.com
SUPPORT_EMAIL=mddnnbr@gmail.com
```

4. Copy `docusign_private.key` into the Railway backend via a Volume or base64-encode it:
   - In Railway Variables add: `DOCUSIGN_PRIVATE_KEY_B64=<base64 of the key file>`
   - Update `src/routes/docusign.js` to read from env if file not found

## Step 2: Deploy Frontend

1. New Railway project → Deploy from GitHub → select `propai/frontend` root
2. Add ONE variable:
```
VITE_API_URL=https://<your-backend-railway-url>/api
```
3. Railway auto-runs `npm run build` then `npx serve -s dist -l 3000`

## Step 3: Set Up Stripe Webhook

1. stripe.com/dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://<backend-railway-url>/api/payments/stripe/webhook`
3. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the `whsec_...` signing secret → paste into Railway backend Variables as `STRIPE_WEBHOOK_SECRET`

## Step 4: Custom Domain (blusterling.com via Northwest)

1. Call Northwest Registered Agent: 509-768-2249
2. Ask them to add DNS records pointing blusterling.com to Railway:
   - `A` record or `CNAME` from Railway's provided domain
   - Railway dashboard → Settings → Domains → Add Custom Domain
3. Railway auto-provisions SSL (Let's Encrypt) once DNS propagates (~10 min)

## Step 5: Switch Plaid to Production

When ready for real bank accounts (not sandbox):
1. plaid.com → Team Settings → Request Production Access
2. Update `.env`: `PLAID_ENV=production` and use production `PLAID_SECRET`
3. Test with user_good/pass_good stops working — real bank login required

## Step 6: DocuSign Production

1. admin.docusign.com → Apps and Keys → confirm RSA key pair is active
2. Change `DOCUSIGN_BASE_URL` from `https://demo.docusign.net/restapi` to `https://na4.docusign.net/restapi`
3. Requires going live approval from DocuSign — submit via developer portal
