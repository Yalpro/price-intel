# DigitalOcean Production Deployment Guide (Scraper Backend)

This guide provides step-by-step instructions for deploying the **UK Price Comparison Scraper Backend** to a **DigitalOcean Docker Droplet** running Ubuntu 22.04 / 24.04 with Docker & Docker Compose.

---

## 📋 Recommended Server Specifications

- **Operating System:** Ubuntu 22.04 / 24.04 LTS (with Docker pre-installed)
- **Minimum Plan:** 2 vCPUs, 4 GB RAM (General Purpose or Basic Droplet)
- **Recommended Plan:** 4 vCPUs, 8 GB RAM (Handles Playwright headless Chromium & Xvfb smoothly)
- **Storage:** 25 GB+ NVMe SSD
- **Network:** Public IPv4 address

---

## A. GitHub Workflow & Branch Verification

1. Ensure all changes are committed and pushed on your feature branch:
   ```powershell
   git status
   git add .
   git commit -m "chore: prepare scraper backend for DigitalOcean deployment"
   git push -u origin chore/production-scraper-cleanup
   ```
2. Open a Pull Request on GitHub to merge `chore/production-scraper-cleanup` into your primary branch (e.g., `main`).
3. Merge the Pull Request after review.

---

## B. Creating the DigitalOcean Droplet

1. Log into your **DigitalOcean Control Panel**.
2. Click **Create** (top right) -> **Droplets**.
3. **Choose Image:** Select **Marketplace** tab -> Search for **Docker on Ubuntu** (or select standard **Ubuntu 24.04 LTS**).
4. **Choose Size:** Select **Basic** or **General Purpose**:
   - Minimum: **$24/mo** (4 GB RAM / 2 vCPUs)
   - Recommended: **$48/mo** (8 GB RAM / 4 vCPUs)
5. **Choose Datacenter Region:** Select **London (LON1)** for low latency to UK supplier portals.
6. **Authentication:**
   - Select **SSH Key** (Recommended). Click **New SSH Key** and paste your public key (`~/.ssh/id_rsa.pub`).
7. **Hostname:** Enter `uk-price-comparison-scraper`.
8. Click **Create Droplet**. Note down your server's Public IP address (e.g. `203.0.113.50`).

---

## C. Server Access & Directory Setup

1. Open **Windows PowerShell** on your local machine.
2. Connect to your Droplet via SSH:
   ```powershell
   ssh root@YOUR_DROPLET_IP
   ```
3. Update system packages and verify Docker:
   ```bash
   apt update && apt upgrade -y
   docker --version
   docker compose version
   ```
4. Create the application parent folder and clone your private repository:
   ```bash
   mkdir -p /var/www
   cd /var/www
   git clone https://github.com/YOUR_GITHUB_USERNAME/UK-PRICE-COMPARSION-WEBAPP.git scraper-app
   cd scraper-app/scraper
   ```

---

## D. Environment Variables Configuration

1. Copy the environment variables template:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in nano editor to set production credentials:
   ```bash
   nano .env
   ```
3. Fill in your real production credentials:
   ```ini
   PORT=4000
   NODE_ENV=production

   # Supabase Credentials
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_actual_supabase_service_role_key

   # API Security Secret (Protects /api/scrapers/run)
   SCRAPER_API_SECRET=your_strong_random_secret_token_here

   # Booker Account Credentials
   BOOKER_CUSTOMER_NUMBER=your_booker_customer_number
   BOOKER_USERNAME=your_booker_email
   BOOKER_PASSWORD=your_booker_password

   # Parfetts Account Credentials
   PARFETTS_USERNAME=your_parfetts_username
   PARFETTS_PASSWORD=your_parfetts_password

   # Bestway Account Credentials
   BESTWAY_USERNAME=your_bestway_username
   BESTWAY_PASSWORD=your_bestway_password
   ```
4. Press `Ctrl + O` then `Enter` to save, and `Ctrl + X` to exit.
5. Secure your `.env` file permissions:
   ```bash
   chmod 600 .env
   ```

---

## E. Docker Container Deployment

1. Build the Docker image:
   ```bash
   docker compose build
   ```
2. Start the container in detached background mode:
   ```bash
   docker compose up -d
   ```
3. Check container status:
   ```bash
   docker compose ps
   ```
4. Stream application logs to verify server startup:
   ```bash
   docker compose logs -f
   ```
   *(Press `Ctrl + C` to exit log streaming)*

---

## F. Health Endpoint & Smoke Test Verification

1. Test the server `/health` endpoint locally on the Droplet:
   ```bash
   curl http://localhost:4000/health
   ```
   *Expected response:* `{"status":"ok","message":"Scraper Service is running."}`

2. Trigger a single controlled Costco API smoke test run:
   ```bash
   curl -X POST http://localhost:4000/api/scrapers/run \
     -H "Content-Type: application/json" \
     -H "x-api-secret: your_strong_random_secret_token_here" \
     -d '{"supplier": "costco"}'
   ```
   *Expected response:* `{"message":"Scraper for 'costco' dispatched successfully."}`

3. Check status of the Costco scraper run:
   ```bash
   curl "http://localhost:4000/api/scrapers/status?supplier=costco"
   ```

---

## G. Session Persistence & Restart Protection

- Playwright browser session states for Booker and Parfetts are stored in `/app/sessions`.
- This directory is persisted using the Docker volume `scraper_sessions`.
- To verify session files survive container restarts:
   ```bash
   docker compose restart
   docker compose exec scraper-backend ls -la /app/sessions
   ```

---

## H. Firewall (UFW) & Nginx Reverse Proxy Setup (Optional)

1. Enable UFW firewall on the Droplet:
   ```bash
   ufw allow OpenSSH
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```
2. Install Nginx and Certbot for SSL (HTTPS):
   ```bash
   apt install -y nginx certbot python3-certbot-nginx
   ```
3. Configure Nginx proxy pass to `http://127.0.0.1:4000`.

---

## I. Updating the Scraper Backend Later

When pushing new code updates to GitHub:

```bash
cd /var/www/scraper-app/scraper
git pull origin main
docker compose build
docker compose up -d
```

---

## J. Rollback Plan

If a newly deployed build encounters issues, rollback instantly to a previous Git commit:

```bash
git log -n 5 --oneline
git checkout <previous-commit-hash>
docker compose build
docker compose up -d
```
