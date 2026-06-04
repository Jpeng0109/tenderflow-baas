import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodesRouter from './routes/nodes.js';
import topologyRouter from './routes/topology.js';
import explorerRouter from './routes/explorer.js';
import { logger } from './utils/logger.js';

const SERVICE_MODE = process.env.SERVICE_MODE || 'unified';
const PORT = parseInt(process.env.PORT || '4100', 10);

const app = express();
const isCloudDemo = process.env.CLOUD_DEMO_MODE === 'true';
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(isCloudDemo || !corsOrigins?.length ? { origin: true } : { origin: corsOrigins }));
app.use(express.json());

const CONSOLE_URL = process.env.CONSOLE_URL || 'http://localhost:5173';
const EXPLORER_URL = process.env.EXPLORER_URL || 'http://localhost:5174';

app.get('/health', async (_req, res) => {
  let ledgerConnected = false;
  if (!isCloudDemo && (SERVICE_MODE === 'explorer' || SERVICE_MODE === 'unified')) {
    try {
      const { isLedgerAvailable } = await import('./services/fabricLedgerService.js');
      ledgerConnected = await isLedgerAvailable();
    } catch { /* not ready */ }
  }
  res.json({
    service: 'fx-bridge-platform-api',
    mode: SERVICE_MODE,
    status: 'ok',
    cloudDemo: isCloudDemo,
    ledgerConnected,
    deployTag: '2026-06-04-r4',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', async (_req, res) => {
  let ledgerConnected = false;
  try {
    const { isLedgerAvailable } = await import('./services/fabricLedgerService.js');
    ledgerConnected = await isLedgerAvailable();
  } catch { /* not ready */ }

  const ledgerLabel = ledgerConnected ? 'Live Ledger' : 'Standby / Demo';
  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Financial Bridge API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1419; color: #e7ecf1; min-height: 100vh; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 1.75rem; font-weight: 600; margin-bottom: 8px; }
    .sub { color: #8b949e; margin-bottom: 32px; font-size: 0.95rem; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 0.8rem;
      background: ${ledgerConnected ? '#1a4731' : '#3d2f00'}; color: ${ledgerConnected ? '#3fb950' : '#d29922'}; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; text-decoration: none; color: inherit; transition: border-color .15s; }
    .card:hover { border-color: #58a6ff; }
    .card h2 { font-size: 1rem; margin-bottom: 6px; color: #58a6ff; }
    .card p { font-size: 0.85rem; color: #8b949e; }
    section { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }
    section h3 { font-size: 0.9rem; color: #8b949e; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    td { padding: 8px 0; border-bottom: 1px solid #21262d; }
    td:first-child { color: #58a6ff; font-family: monospace; width: 45%; }
    td:last-child { color: #8b949e; }
    tr:last-child td { border-bottom: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Financial Bridge Platform API</h1>
    <p class="sub">跨境金融桥 · 统一后端 · 端口 ${PORT} · <span class="badge">${ledgerLabel}</span></p>

    <div class="cards">
      <a class="card" href="${CONSOLE_URL}" target="_blank">
        <h2>① 管理控制台</h2>
        <p>拓扑图、启动集群、动态扩缩节点</p>
      </a>
      <a class="card" href="${EXPLORER_URL}" target="_blank">
        <h2>② 区块链浏览器</h2>
        <p>Etherscan 风格 · 区块 / 交易 / RW-set</p>
      </a>
      <a class="card" href="/health">
        <h2>Health Check</h2>
        <p>JSON 健康检查接口</p>
      </a>
    </div>

    <section>
      <h3>API Endpoints</h3>
      <table>
        <tr><td>GET /api/topology</td><td>14 节点拓扑状态</td></tr>
        <tr><td>POST /api/nodes/cluster/start</td><td>启动 Fabric 集群</td></tr>
        <tr><td>POST /api/nodes/bootstrap</td><td>完整区块链引导</td></tr>
        <tr><td>GET /api/explorer/telemetry</td><td>区块高度 / 活跃节点</td></tr>
        <tr><td>GET /api/explorer/blocks/latest</td><td>最新区块列表</td></tr>
        <tr><td>GET /api/explorer/transactions/latest</td><td>最新交易列表</td></tr>
      </table>
    </section>
  </div>
</body>
</html>`);
});

if (SERVICE_MODE === 'orchestrator' || SERVICE_MODE === 'unified') {
  app.use('/api/nodes', nodesRouter);
  app.use('/api/topology', topologyRouter);
}

if (SERVICE_MODE === 'explorer' || SERVICE_MODE === 'unified') {
  app.use('/api/explorer', explorerRouter);
}

app.use((err, _req, res, _next) => {
  logger.error(err.message);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, process.env.ORCHESTRATOR_HOST || '0.0.0.0', () => {
  logger.info(`Financial Bridge API listening on :${PORT} [${SERVICE_MODE}]`);
});
