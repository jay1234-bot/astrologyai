# Deployment Guide — पंडित हरिनाथ शास्त्री AI Backend

This project consists of two components:
1. **D1 API Worker**: A Cloudflare Worker providing a secure interface to the D1 SQLite database.
2. **API Server**: A Node.js backend (using Hono) that handles WhatsApp Webhooks and AI processing, designed to be deployed on Render.

## Prerequisites

- Cloudflare account
- Render account
- Meta Developer account (for WhatsApp Cloud API)
- Google AI Studio account (for Gemini API)
- Node.js (v20+) and pnpm/npm

---

## Part 1: Deploying the Cloudflare D1 Database & Worker

The database is powered by Cloudflare D1 and accessed securely by the API server via a Cloudflare Worker.

### 1. Authenticate with Cloudflare
```bash
npx wrangler login
```

### 2. Create the D1 Database
Run this command from the root directory:
```bash
npx wrangler d1 create pandit-harinath-db
```
*Note the `database_name` and `database_id` returned in your terminal.*

### 3. Update `wrangler.toml`
Open `apps/d1-api/wrangler.toml` (create it if missing) and update the `database_id` with the ID from the previous step.

```toml
name = "pandit-harinath-d1-api"
main = "src/index.ts"
compatibility_date = "2024-02-23"

[[d1_databases]]
binding = "DB"
database_name = "pandit-harinath-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Apply Database Migrations
Initialize the schema (users, conversations, messages, knowledge, etc.):
```bash
cd apps/d1-api
npm run db:migrate:remote
```

### 5. Generate and Set the D1 API Secret
Generate a random secret (e.g., using `openssl rand -hex 32` or a password generator).
Save this secret securely; you will need it for the Render deployment.

Set the secret on Cloudflare:
```bash
npx wrangler secret put D1_API_SECRET
# Paste your generated secret when prompted
```

### 6. Deploy the Worker
```bash
npm run deploy
```
*Note the URL of your deployed worker (e.g., `https://pandit-harinath-d1-api.your-subdomain.workers.dev`).*

---

## Part 2: Deploying the API Server on Render

The main API server handles webhooks, AI processing, and communicates with the D1 Worker.

### 1. Create a Web Service on Render
1. Go to your Render Dashboard and click **New+** > **Web Service**.
2. Connect your Git repository.
3. Configure the service:
   - **Name**: `pandit-harinath-ai` (or similar)
   - **Region**: Choose the one closest to your users.
   - **Branch**: `main`
   - **Root Directory**: `apps/api`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`

### 2. Configure Environment Variables
In the Render Web Service settings, add the following Environment Variables:

**Database Connection:**
- `D1_API_URL`: The URL of your deployed Cloudflare Worker (from Part 1, Step 6).
- `D1_API_SECRET`: The secret you generated (from Part 1, Step 5).

**Google Gemini:**
- `GEMINI_API_KEY`: Your API key from Google AI Studio.
- `GEMINI_MODEL`: `gemini-1.5-flash`

**WhatsApp / Meta Configuration:**
- `WHATSAPP_ACCESS_TOKEN`: Your permanent access token from Meta.
- `WHATSAPP_PHONE_NUMBER_ID`: Your phone number ID from Meta.
- `WHATSAPP_VERIFY_TOKEN`: A custom random string you invent (used for webhook verification in Part 3).
- `META_APP_SECRET`: Your Meta App Secret (found in App Dashboard > App Settings > Basic).

**General Configuration:**
- `NODE_ENV`: `production`
- `PORT`: `3000` (Render will override this, which is fine)
- `ADMIN_API_KEY`: A custom random string for securing admin endpoints.
- `AI_ENABLED`: `true`

### 3. Deploy
Save the environment variables and Render will automatically build and deploy your service.
*Note the public URL of your Render service (e.g., `https://pandit-harinath-ai.onrender.com`).*

---

## Part 3: Configuring the Meta WhatsApp Webhook

Once the Render service is live, you must configure Meta to send incoming messages to it.

1. Go to the **Meta App Dashboard**.
2. Navigate to **WhatsApp** > **Configuration**.
3. Under the **Webhook** section, click **Edit**.
4. Set the **Callback URL** to:
   `https://[YOUR_RENDER_URL]/webhook`
   *(Example: `https://pandit-harinath-ai.onrender.com/webhook`)*
5. Set the **Verify Token** to the exact string you used for `WHATSAPP_VERIFY_TOKEN` in Render.
6. Click **Verify and Save**. (Meta will make a GET request to your webhook to verify).
7. Under **Webhook Fields**, click **Manage** and subscribe to the `messages` field.

## Part 4: Populating Knowledge Base

Currently, the knowledge base is managed through the D1 API Worker.
To insert the markdown documents into the database, you can use the D1 API endpoint `/knowledge` or directly insert them via Cloudflare Dashboard or Wrangler.

*(A sync script or admin dashboard will be provided in Phase 3 for easier knowledge base management).*
