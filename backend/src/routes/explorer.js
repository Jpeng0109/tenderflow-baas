import { Router } from 'express';
import {
  getDashboardTelemetry,
  getLatestBlocks,
  getLatestTransactions,
  getTransactionDetail,
  getBlockDetail,
  searchExplorer,
  getSyncedNodes,
} from '../services/explorerService.js';

const router = Router();

router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  res.json(await searchExplorer(q));
});

router.get('/telemetry', async (_req, res) => {
  const telemetry = await getDashboardTelemetry();
  res.json(telemetry);
});

router.get('/blocks/latest', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '8', 10), 50);
  const blocks = await getLatestBlocks(limit);
  res.json({ blocks });
});

router.get('/transactions/latest', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '40', 10), 100);
  const transactions = await getLatestTransactions(limit);
  res.json({ transactions, count: transactions.length });
});

router.get('/nodes/sync', async (_req, res) => {
  res.json(await getSyncedNodes());
});

router.get('/blocks/:num', async (req, res) => {
  res.json(await getBlockDetail(req.params.num));
});

router.get('/transactions/:hash', async (req, res) => {
  const detail = await getTransactionDetail(req.params.hash);
  res.json(detail);
});

export default router;
