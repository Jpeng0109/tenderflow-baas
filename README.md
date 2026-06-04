# TENDERFLOW Platform

Hyperledger Fabric tendering experiment — **Explorer**, **Console**, and unified **API**.

## Architecture (production)

| Component | Host | Directory |
|-----------|------|-----------|
| API | [Render](https://render.com) | `backend/` |
| Explorer | [Vercel](https://vercel.com) | `explorer/` |
| Console | [Vercel](https://vercel.com) | `console/` |

## Local development

```bash
cd backend && npm install && npm start          # :4100
cd console && npm install && npm run dev      # :5173
cd explorer && npm install && npm run dev     # :5174
```

## Deploy API (Render)

1. Push to GitHub.
2. [New Blueprint](https://dashboard.render.com/blueprint/new?repo=https://github.com/Jpeng0109/tenderflow-baas) → deploy `tenderflow-api` only.
3. After Vercel frontends are live, set in Render **Environment**:
   - `CONSOLE_URL` → your Vercel console URL
   - `EXPLORER_URL` → your Vercel explorer URL

Health check: `https://tenderflow-api.onrender.com/health`

## Deploy frontends (Vercel)

Create **two** Vercel projects from the same repo:

### Explorer

- **Root Directory:** `explorer`
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment:** `VITE_API_ORIGIN=https://tenderflow-api.onrender.com`

### Console

- **Root Directory:** `console`
- Same build settings as Explorer.

Or use Vercel CLI:

```bash
cd explorer && npx vercel --prod
cd console && npx vercel --prod
```

`.env.production` in each folder already points to the Render API URL.

## Repository

https://github.com/Jpeng0109/tenderflow-baas
