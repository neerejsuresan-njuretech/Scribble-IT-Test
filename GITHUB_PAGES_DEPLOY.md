# Hosting Scribble IT on GitHub Pages

Scribble IT is pre-configured for automated static hosting on **GitHub Pages** using Vite's relative asset paths (`base: './'`), `HashRouter` client routing, `.nojekyll`, `404.html`, and a GitHub Actions workflow.

## 1. Enable GitHub Pages (One-Time Setup)

1. Push this repository to GitHub (branch `main` or `master`).
2. In your GitHub repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push a commit (or open the **Actions** tab and click **Run workflow** on **Deploy Scribble IT to GitHub Pages**).
5. Your live site will publish to `https://<your-username>.github.io/<your-repo-name>/` (or your configured custom domain).

## 2. What Works Out of the Box on GitHub Pages (100% Static)

- Pre-login Scribble IT overview website & instant multi-role Demo Launcher
- All 31 ITSM modules (Incidents, Requests, Problems, Changes/CAB, CMDB, Assets, Inventory, Contracts, Domains, War Room, Morning Checks, LMS, Tasks, Projects, Reports, Billing)
- Figma-style Wireframe Process Mapper & Multi-Step Workflow Builder
- Multi-Tenant Directory, Module Controls, and 4 Isolated Portals (Super Admin, Employee, IAM, End User)
- Telephony Softphone: Embedded Amazon Connect CCP v2 / Custom CTI iframe, Web Audio DTMF dialpad, Browser Mic Check, Personal Mobile native dialer (`tel:`/`sms:`), Desktop-to-Mobile QR Scan-to-Call, and GSM forwarding codes
- Dot-Matrix Dark Mode & Inverted Corporate Light Mode

## 3. Optional: Connecting Backend AI & Carrier Bridge Routes

GitHub Pages serves static files only and does not run the Node.js Express server (`server.ts`). If you want live **Gemini AI Triage**, **Google Search Wiki Grounding**, or **Twilio Two-Leg Carrier Bridging** on your GitHub Pages deployment:

1. Deploy `server.ts` to any Node.js host (Google Cloud Run, Render, Railway, Fly.io) with `GEMINI_API_KEY` (and optional Twilio secrets) set in its environment variables, plus `ALLOWED_ORIGIN="https://<your-username>.github.io"`.
2. In your GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add a repository variable:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://your-backend-service-url` (no trailing slash)
3. Re-run the **Deploy Scribble IT to GitHub Pages** workflow.

## 4. Custom Domain (Optional)

If you use a custom domain (e.g., `itsm.yourdomain.com`), configure it in **Settings → Pages → Custom domain** or add a `public/CNAME` file containing your domain name.
