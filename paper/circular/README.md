# Circular Economy Paper — Revision Pipeline

Revised manuscript (original **not modified**):

`E:\Jp\hyperledge fabric\A Circular Economy Framework for Community-Scale_REVISED_20260604.docx`

## Run (from repo root)

```powershell
python paper/circular/run_circular_simulation.py
python paper/circular/generate_circular_figures.py
python paper/circular/generate_circular_paper.py
```

## What changed vs. original

| Item | Action |
|------|--------|
| Section 3 | Added proper numbering; formal Figure 1 |
| Section 4.3 | Removed inline Go draft; Algorithm 1 + Appendix A |
| Section 5.5–5.6 | **New** — 14-node Fabric isomorphic simulation |
| References | Expanded to 35 citations |
| Figures | fig1–fig8 in `paper/circular/figures/` |
| Fabric vs ERC-1155 | Unified terminology |

## Blockchain simulation (no chaincode changes)

Uses existing TENDERFLOW 14-node testbed with semantic mapping:

| Water–carbon step | Chaincode function |
|-------------------|-------------------|
| Register project | `CreateTender` |
| Commit NCB hash | `CommitBid` |
| Auditor verify | `RevealBid` |
| Compliance score | `UpdateBehavioralReputation` |

If `fabric-cli` is offline, metrics are relabeled from `paper/raw-data/experiment_latest.json`.

## Outputs

- `paper/circular/raw-data/circular_experiment_latest.json`
- `paper/circular/figures/fig1–fig8.png`
- Revised DOCX at parent `hyperledge fabric/` folder
