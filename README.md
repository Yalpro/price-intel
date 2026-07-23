# Wholesaler Price Comparison PWA

An internal tool for comparing wholesale prices across Booker, Parfetts, and Dhamecha.

## Prerequisites
- Node.js (v18+)
- Supabase Project (Postgres)

## Setup Instructions

1. **Clone & Install Dependencies**
   - Frontend: `cd frontend && npm install`
   - Scraper: `cd scraper && npm install` (Also run `npx playwright install` if needed)

2. **Environment Variables**
   - Copy `.env.example` to `.env` in the root (or in each specific folder if separated).
   - Fill in your Supabase credentials and Wholesaler logins.
   - **Important**: Use the Service Role Key for the scraper and Anon Key for the frontend.

3. **Database Setup**
   - Run the SQL statements in `supabase/migrations/00000000000000_init.sql` against your Supabase database using the Supabase Dashboard.
   - Enable Auth in Supabase and create a user to bypass RLS.

4. **Running the App**
   - **Frontend**: `cd frontend && npm run dev`
   - **Scraper**: Ensure `top_products_ranked.csv` is in the root directory. Run `cd scraper && node index.js` (or `npm start`).

## ⚠️ Pre-Production Auth Checklist (Required Before Public Launch)

> **Important**: Email confirmation is currently disabled in Supabase Auth settings for local development convenience. Before launching to real users, complete the following setup:

1. **Transactional SMTP Provider Setup**
   - Connect a dedicated email provider (Resend, Postmark, or SendGrid) in **Supabase Dashboard → Authentication → Settings → SMTP Settings**.
   - Custom SMTP removes Supabase's default email rate limits and prevents confirmation/reset emails from going to spam.

2. **Re-Enable Email Confirmation**
   - In **Supabase Dashboard → Authentication → Providers → Email**, re-enable **"Confirm email"**.
   - This prevents unverified/fake/typo emails from registering accounts.

3. **Brand Email Templates**
   - Customize auth templates in **Dashboard → Authentication → Email Templates** with PriceIntel branding, styling, and copy.

4. **URL & Redirect Configuration**
   - In **Dashboard → Authentication → URL Configuration**, set **Site URL** and **Redirect URLs** to your official production domain (replacing `localhost`).

5. **Auth Rate Limit Audit**
   - Review and adjust auth rate limits (**Dashboard → Authentication → Rate Limits**) to accommodate expected signup spikes without blocking legitimate users.

