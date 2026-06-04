# TENDERFLOW Platform

Hyperledger Fabric tendering experiment — **Explorer** (blockchain browser), **Console** (network orchestration UI), and unified **API** backend.

## Local development

```bash
# Terminal 1 — API
cd backend && npm install && npm start

# Terminal 2 — Console
cd console && npm install && npm run dev

# Terminal 3 — Explorer
cd explorer && npm install && npm run dev
```

| Service  | URL |
|----------|-----|
| API      | http://localhost:4100 |
| Console  | http://localhost:5173 |
| Explorer | http://localhost:5174 |

When Docker/Fabric is offline, the API serves **mainnet experiment snapshot** data from `backend/data/experiment_latest.json`.

## Deploy to Render

1. Push this repo to GitHub (see below).
2. In [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.
3. Connect the GitHub repo; Render reads `render.yaml` and creates 3 services:
   - `tenderflow-api` — Node.js API
   - `tenderflow-explorer` — static Explorer UI
   - `tenderflow-console` — static Console UI
4. Wait for all builds to finish. Frontends receive `VITE_API_ORIGIN` from the API service URL automatically.

**Note:** On Render, Docker/Fabric cluster operations are unavailable. Console shows static topology; Explorer shows measured mainnet experiment data.

## Push to GitHub

```bash
git init
git add .
git commit -m "Add Explorer, Console, API and Render deployment config"
gh auth login
gh repo create tenderflow-baas --public --source=. --remote=origin --push
```

Or create a repo manually on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USER/tenderflow-baas.git
git branch -M main
git push -u origin main
```

After push, connect the repo in Render via Blueprint.
