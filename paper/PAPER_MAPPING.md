# TENDERFLOW Paper ↔ 14-Node Fabric Mapping

## Ma'anshan Yangtze River Bridge Experiment

| Paper Role | Count (Paper) | Fabric Implementation | Hostname Prefix |
|------------|---------------|----------------------|-----------------|
| Tender consensus cluster | 5 | 5 RAFT orderers | `orderer1–5.clearing-raft.org` |
| Provincial Transport Dept. | 4 regulator nodes | 3 endorsing peers + 1 client gateway | `peer0–2.centralbank.gov` |
| Tier-1 Construction Cos. | 8 bidders | 3 peers + 8 client identities | `peer0–2.liquidity-bankA.com` |
| Auditors + Financial Inst. | 2 + 2 | 3 endorsing peers | `peer0–2.liquidity-bankB.com` |
| **Total infrastructure** | **14** | **5 + 9 = 14 nodes** | |

## Channel & Chaincode

- **Channel ID:** `tenderflow-channel`
- **Chaincode:** `chaincode/tenderflow/` — CommitBid, RevealBid, UpdateBehavioralReputation
- **State DB:** CouchDB (rich JSON queries for bid/reputation records)

## Simulation Bidders (Section 5.3)

| ID | Verified Rep (Vi) | Scenario 2 Outcome |
|----|-------------------|-------------------|
| Bidder-A | 0.95 | Shortlisted (static mode winner) |
| Bidder-B | 0.95 | **Filtered** (recent bond breach, −15%) |
| Bidder-C | 0.78 | **Awarded** (12 consecutive successes) |
| Bidder-D–H | 0.74–0.88 | Mid-tier competitors |

## Paper Assets

- Figures: `paper/figures/fig1–fig8.png`
- Completed manuscript: `paper/TENDERFLOW_Paper_Complete_20260602.docx`
- Regenerate: `python paper/generate_figures.py` / `python paper/generate_paper.py`

## Platform URLs

- Console: http://localhost:5173
- Explorer: http://localhost:5174
- API: http://localhost:4100
