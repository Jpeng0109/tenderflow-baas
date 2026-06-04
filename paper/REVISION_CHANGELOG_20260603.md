# TENDERFLOW Paper — Mainnet Revision Changelog

**Output file:** `TENDERFLOW_Paper_Mainnet_Revised_Highlighted_20260603.docx`
**Experiment:** `mainnet_20260603_121730`
**Source data:** `paper/raw-data/experiment_latest.json`

## Highlight legend
- **Blue font + yellow highlight** in DOCX = text revised to reflect live mainnet measurements.

## Mainnet metrics used
- Channel: `fx-bridge-channel`
- Block height: **23**
- Infrastructure: **14** nodes (5 orderers + 9 peers)
- Fabric: **2.5.12** (CCAAS chaincode)
- Simulation invokes: **37** (36 OK, 97.3%)
- Blocks produced (simulation phase): **11**
- Throughput: **2.14 TPS** (30 sequential CommitBid benchmark)
- Latency p95 / avg: **416.05 ms / 356.42 ms**
- Static winner: **Bidder-A** (Vi=0.95)
- Dynamic winner: **Bidder-A** (total=0.647)
- Bidder B after breach: total **0.635** (filtered)
- Bidder C after 12 updates: total **0.641**

## Removed or qualified (not measured on mainnet)
- **350 TPS** — replaced with measured **2.14 TPS** sequential benchmark
- **71% administrative cost reduction** — removed (no cost instrumentation on mainnet)
- **45 days → 2 seconds** — replaced with measured **p95 416 ms** invoke latency
- **+40% selection pool integrity** — replaced with Bidder B breach filtering evidence
- **Bidder C awarded** — corrected to **Bidder A** highest total score on mainnet

## Text replacements applied

1. `Experimental simulation of the Ma'anshan Yangtze River Rail cum Road Bridge demonstrates that the pr...`
   → `A live 14-node Hyperledger Fabric mainnet (five RAFT orderers, nine endorsing peers, CouchDB state, ...`

2. `The contract was awarded to Bidder C, who possessed a lower  but a significantly higher due to 12 co...`
   → `Bidder-A ranked highest on-chain (total score 0.647) after Bidder B was penalized; Bidder C rose to ...`

3. `The simulation results indicate that the TENDERFLOW mode enhances the Integrity of the Selection Poo...`
   → `Mainnet simulation showed measurable integrity gain: Bidder B (initial Vi=0.95) was filtered after a...`

4. `peak throughput of 350 TPS`
   → `measured sequential throughput of 2.14 TPS on the 14-node mainnet`

5. `Even under high load scenarios (1,000 concurrent requests), the latency for the "Commit" transaction...`
   → `Measured mainnet CommitBid invoke latency averaged 356.42 ms with p95 416.05 ms under sequential loa...`

6. `Traditional manual verification of contractor qualifications and bid bond authenticity typically tak...`
   → `On-chain RevealBid integrity checks and GetReputation queries completed within the measured invoke/q...`

7. `By replacing centralized third-party clearinghouses with cryptographic proofs, the simulated annual ...`
   → `Direct mainnet cost accounting was outside the scope of this deployment; administrative efficiency i...`

8. `Automated verification of bid bonds and credentials reduces the verification latency from 45 days to...`
   → `Automated on-chain RevealBid and reputation queries in the mainnet test completed within 416.05 ms (...`

9. `Despite the documented efficiency gains (71% cost reduction), several challenges remain for large-sc...`
   → `Despite documented mainnet performance and integrity gains, several challenges remain for large-scal...`

10. `While 350 TPS is sufficient for individual bridge projects, industry-wide adoption across thousands ...`
   → `While 2.14 TPS (sequential mainnet benchmark) suffices for sealed-bid phases of mega-projects, indus...`

11. `peak throughput of 350 TPS`
   → `measured sequential throughput of 2.14 TPS on the 14-node mainnet`

12. `The informatics-driven approach achieved a 99.9% reduction in verification latency, transforming a 4...`
   → `Mainnet invokes achieved 97.3% success across 37 lifecycle transactions with p95 latency 416.05 ms, ...`

13. `research into Layer-2 scaling solutions (like state channels) is necessary to increase throughput be...`
   → `horizontal scaling and invoke batching should be studied to raise throughput beyond the measured 2.1...`

14. ` The results validate that transitioning from static qualification to dynamic onchain behavior reput...`
   → ``

15. `Transaction Throughput (TPS): The network achieved a measured sequential throughput of 2.14 TPS on t...`
   → `Transaction Throughput (TPS): Sequential mainnet benchmarking recorded 2.14 TPS (30 CommitBid invoke...`
