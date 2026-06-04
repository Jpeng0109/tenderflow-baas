# Three Components — Completion Guide

## Step 1: Blockchain Layer (14 nodes)

**Deliverables**
- `config/crypto-config.yaml` + `config/configtx.yaml`
- `docker/docker-compose-fabric-14.yaml` (5 orderers + 9 peers + CouchDB + 3 Fabric CA)
- Bootstrap: `scripts/network-bootstrap.sh` | `scripts/bootstrap.ps1`

**Run**
```bash
bash scripts/network-bootstrap.sh
# Windows
.\scripts\bootstrap.ps1
bash scripts/verify-network.sh
```

**API**
- `POST /api/nodes/bootstrap` — full pipeline from Console UI
- `POST /api/nodes/cluster/start` — docker compose up

---

## Step 2: Orchestration Console (Component 1)

**Deliverables**
- SVG **Interactive Topology Map** (`TopologyMap.jsx`)
- **Operations Panel** — bootstrap, scale-up, decommission (`OperationsPanel.jsx`)
- Dark enterprise UI (`console.css`)

**Run**
```bash
cd console && npm install && npm run dev
# http://localhost:5173
```

---

## Step 3: Etherscan Explorer (Component 2)

**Deliverables**
- Split-screen **Latest Blocks | Latest Transactions**
- **Search** — tx hash, block #, asset pair (`SearchBar.jsx`)
- **Block detail** + **RW-set inspector** on tx detail
- Live ledger via Gateway; demo feed when cluster offline

**Run**
```bash
cd explorer && npm install && npm run dev
# http://localhost:5174
```

**API**
- `GET /api/explorer/telemetry`
- `GET /api/explorer/blocks/latest`
- `GET /api/explorer/blocks/:num`
- `GET /api/explorer/transactions/latest`
- `GET /api/explorer/transactions/:hash`
- `GET /api/explorer/search?q=`

---

## Start Everything

```bash
npm run bootstrap      # Step 1
npm run platform       # Steps 2+3 UIs + backend :4100
```

Windows:
```powershell
npm run bootstrap:win
npm run platform:win
```
