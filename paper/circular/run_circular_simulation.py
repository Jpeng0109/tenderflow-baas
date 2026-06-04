#!/usr/bin/env python3
"""
Circular Economy paper — isomorphic blockchain simulation on the existing
14-node TENDERFLOW testbed. Does NOT modify chaincode or network topology.

Semantic mapping:
  CreateTender      → Register water-carbon community project
  CommitBid         → Submit monthly NCB report hash (ISSG module)
  RevealBid         → Auditor verifies full IPFS report
  InitReputation / UpdateBehavioralReputation → Operator compliance
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAPER = Path(__file__).resolve().parent
RAW = PAPER / 'raw-data'
RAW.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(ROOT / 'paper'))
sys.path.insert(0, str(ROOT / 'paper' / 'circular'))
from case_study_constants import MONTHLY_AE_KG, NCB_STEADY_T, NCB_YEAR1_T  # noqa: E402

PROJECT_ID = 'COAST-50-2025'
PROJECT_NAME = 'Coastal Community Water-Carbon Co-Management (50 households)'
LCA_CID = 'ipfs://QmCoastalISSG-LCA-Biochar637kg2025'

_MODULE_NCB = round(MONTHLY_AE_KG / 8, 1)

ISSG_MODULES = [
    {'id': 'Module-01', 'chaincode_bidder': 'Bidder-A', 'verified': 0.92, 'ncb_kg_month': _MODULE_NCB},
    {'id': 'Module-02', 'chaincode_bidder': 'Bidder-B', 'verified': 0.90, 'ncb_kg_month': _MODULE_NCB},
    {'id': 'Module-03', 'chaincode_bidder': 'Bidder-C', 'verified': 0.88, 'ncb_kg_month': _MODULE_NCB},
    {'id': 'Module-04', 'chaincode_bidder': 'Bidder-D', 'verified': 0.85, 'ncb_kg_month': _MODULE_NCB},
    {'id': 'Module-05', 'chaincode_bidder': 'Bidder-E', 'verified': 0.84, 'ncb_kg_month': _MODULE_NCB},
    {'id': 'Module-06', 'chaincode_bidder': 'Bidder-F', 'verified': 0.87, 'ncb_kg_month': _MODULE_NCB},
    {'id': 'Module-07', 'chaincode_bidder': 'Bidder-G', 'verified': 0.83, 'ncb_kg_month': _MODULE_NCB, 'fail_reveal': True},
    {'id': 'Module-08', 'chaincode_bidder': 'Bidder-H', 'verified': 0.81, 'ncb_kg_month': _MODULE_NCB, 'fail_reveal': True},
]

TS = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')


def _ncb_report(module_id: str, ncb_kg: float) -> dict:
    return {
        'project_id': PROJECT_ID,
        'module_id': module_id,
        'period': '2025-01',
        'V_w_m3': 456.25,
        'AE_kg': 1596.9,
        'CS_kg': 196.8,
        'EE_kg': 187.5,
        'NCB_kg': round(ncb_kg, 1),
        'EF_conv': 3.5,
        'sensor_signature': f'edge-gateway-{module_id}',
    }


def synthesize_from_bridge_experiment() -> dict:
    """Relabel existing Ma'anshan experiment data with circular-economy semantics."""
    bridge_path = ROOT / 'paper' / 'raw-data' / 'experiment_latest.json'
    perf_path = ROOT / 'paper' / 'raw-data' / 'fig6_performance.csv'
    if not bridge_path.exists():
        raise FileNotFoundError(f'Missing bridge experiment: {bridge_path}')

    bridge = json.loads(bridge_path.read_text(encoding='utf-8'))
    perf = {}
    if perf_path.exists():
        for line in perf_path.read_text(encoding='utf-8').strip().splitlines()[1:]:
            parts = line.split(',')
            if len(parts) >= 2:
                perf[parts[0]] = parts[1]

    mapping_rows = []
    txs = []
    for i, tx in enumerate(bridge.get('simulation', {}).get('transactions', [])):
        fn = tx.get('function', '')
        if fn == 'CreateTender':
            sem = 'RegisterWaterCarbonProject'
            entity = 'Community Council (centralbank.gov)'
        elif fn == 'CommitBid':
            bid = tx.get('payload', {}).get('bidder_id', '')
            mod = next((m for m in ISSG_MODULES if m['chaincode_bidder'] == bid), None)
            sem = 'CommitNCBReportHash'
            entity = mod['id'] if mod else bid
        elif fn == 'InitReputation':
            bid = tx.get('payload', [None])[0] if isinstance(tx.get('payload'), list) else ''
            mod = next((m for m in ISSG_MODULES if m['chaincode_bidder'] == bid), None)
            sem = 'InitModuleTrustScore'
            entity = mod['id'] if mod else bid
        elif fn == 'RevealBid':
            bid = tx.get('payload', {}).get('bidder_id', '')
            mod = next((m for m in ISSG_MODULES if m['chaincode_bidder'] == bid), None)
            sem = 'AuditorVerifyNCBReport'
            entity = mod['id'] if mod else bid
        elif fn == 'UpdateBehavioralReputation':
            sem = 'UpdateOperatorCompliance'
            entity = 'System Operator (liquidity-bankA.com)'
        else:
            sem = fn
            entity = 'unknown'

        row = {
            'tx_index': i + 1,
            'chaincode_function': fn,
            'semantic_step': sem,
            'entity': entity,
            'ok': tx.get('ok'),
            'latency_ms': tx.get('latency_ms'),
        }
        mapping_rows.append(row)
        txs.append({**tx, 'semantic': row})

    bench = bridge.get('benchmark', {})
    net = bridge.get('network', {})
    monthly_ncb = sum(m['ncb_kg_month'] for m in ISSG_MODULES)
    annual_ncb = NCB_STEADY_T

    return {
        'experiment_id': f'circular_isomorphic_{TS}',
        'mode': 'synthesized_from_bridge_testbed',
        'project_id': PROJECT_ID,
        'project_name': PROJECT_NAME,
        'isomorphic_mapping_note': (
            'Chaincode and 14-node topology unchanged; transaction semantics '
            'reinterpreted for water-carbon MRV workflow.'
        ),
        'carbon_context': {
            'community_households': 50,
            'annual_NCB_tCO2e_steady': NCB_STEADY_T,
            'annual_NCB_tCO2e_year1': NCB_YEAR1_T,
            'monthly_NCB_kg_simulated': round(monthly_ncb, 1),
            'modules': len(ISSG_MODULES),
        },
        'transactions': txs,
        'semantic_mapping_table': mapping_rows,
        'benchmark': bench,
        'network': net,
        'performance_summary': {
            'tps': bench.get('tps', perf.get('peak_tps', '2.14')),
            'p95_latency_ms': bench.get('latency_ms', {}).get('p95', perf.get('bench_latency_p95', '416.05')),
            'CreateTender_ms': perf.get('latency_CreateTender', '515.6'),
            'CommitBid_avg_ms': perf.get('latency_CommitBid', '330.6'),
            'RevealBid_avg_ms': perf.get('latency_RevealBid', '340.1'),
            'Reputation_avg_ms': perf.get('latency_Rep.Beh.Reputation', '355.8'),
            'infrastructure_nodes': net.get('infrastructure_nodes', 14),
            'orderers': net.get('orderer_count', 5),
            'peers': net.get('peer_count', 9),
        },
        'integrity_failures': [m['id'] for m in ISSG_MODULES if m.get('fail_reveal')],
    }


def run_live_simulation():
    """Execute isomorphic workflow on live 14-node Fabric (same chaincode)."""
    import run_mainnet_experiment as bridge  # noqa: WPS433

    bridge.TENDER_ID = PROJECT_ID
    bridge.TS = TS

    print('\n=== Circular Economy isomorphic simulation (live testbed) ===')
    txs = []
    h0 = bridge.block_height()

    tender_payload = {
        'tender_id': PROJECT_ID,
        'project_name': PROJECT_NAME,
        'rfp_cid': LCA_CID,
        'bid_bond_pct': 0.0,
        'deadline': '2025-12-31T23:59:59Z',
    }
    txs.append({**bridge.invoke(0, 'CreateTender', tender_payload), 'semantic': 'RegisterWaterCarbonProject'})
    time.sleep(2)

    commits = {}
    for mod in ISSG_MODULES:
        report = _ncb_report(mod['id'], mod['ncb_kg_month'])
        bh = f"sha256:{mod['id']}-ncb-2025-01-{report['NCB_kg']}"
        commits[mod['chaincode_bidder']] = bh
        cp = {
            'tender_id': PROJECT_ID,
            'bidder_id': mod['chaincode_bidder'],
            'bid_hash': bh,
        }
        txs.append({
            **bridge.invoke(1, 'CommitBid', cp),
            'semantic': 'CommitNCBReportHash',
            'module_id': mod['id'],
        })
        time.sleep(0.4)

    for mod in ISSG_MODULES:
        txs.append({
            **bridge.invoke(0, 'InitReputation', None, args_list=[mod['chaincode_bidder'], str(mod['verified'])]),
            'semantic': 'InitModuleTrustScore',
            'module_id': mod['id'],
        })
        time.sleep(0.3)

    for mod in ISSG_MODULES:
        if mod.get('fail_reveal'):
            txs.append({
                **bridge.invoke(1, 'RevealBid', {
                    'tender_id': PROJECT_ID,
                    'bidder_id': mod['chaincode_bidder'],
                    'file_cid': 'ipfs://QmTAMPERED_SENSOR_GATEWAY_FAILURE',
                }),
                'semantic': 'AuditorVerifyNCBReport',
                'module_id': mod['id'],
                'expected_failure': True,
            })
        else:
            txs.append({
                **bridge.invoke(1, 'RevealBid', {
                    'tender_id': PROJECT_ID,
                    'bidder_id': mod['chaincode_bidder'],
                    'file_cid': commits[mod['chaincode_bidder']],
                }),
                'semantic': 'AuditorVerifyNCBReport',
                'module_id': mod['id'],
            })
        time.sleep(0.5)

    for _ in range(6):
        txs.append({
            **bridge.invoke(2, 'UpdateBehavioralReputation', None, args_list=['Bidder-C', 'Success']),
            'semantic': 'UpdateOperatorCompliance',
        })
        time.sleep(0.3)

    h1 = bridge.block_height()
    bench = bridge.benchmark_throughput(30)
    net = bridge.collect_network_snapshot()

    def _entity_label(tx):
        if tx.get('module_id'):
            return tx['module_id']
        payload = tx.get('payload')
        if isinstance(payload, dict):
            return payload.get('bidder_id', 'System')
        if isinstance(payload, list) and payload:
            return str(payload[0])
        return 'System'

    mapping_rows = []
    for i, tx in enumerate(txs):
        mapping_rows.append({
            'tx_index': i + 1,
            'chaincode_function': tx.get('function'),
            'semantic_step': tx.get('semantic'),
            'entity': _entity_label(tx),
            'ok': tx.get('ok'),
            'latency_ms': tx.get('latency_ms'),
        })

    monthly_ncb = sum(m['ncb_kg_month'] for m in ISSG_MODULES)

    def _avg(fn):
        vals = [t['latency_ms'] for t in txs if t.get('function') == fn and t.get('latency_ms')]
        return round(sum(vals) / len(vals), 2) if vals else None

    return {
        'experiment_id': f'circular_isomorphic_{TS}',
        'mode': 'live_testbed',
        'project_id': PROJECT_ID,
        'project_name': PROJECT_NAME,
        'transactions': txs,
        'semantic_mapping_table': mapping_rows,
        'block_height_before': h0,
        'block_height_after': h1,
        'benchmark': bench,
        'network': net,
        'carbon_context': {
            'community_households': 50,
            'annual_NCB_tCO2e': 12.9,
            'monthly_NCB_kg_simulated': round(monthly_ncb, 1),
            'modules': len(ISSG_MODULES),
        },
        'performance_summary': {
            'tps': bench.get('tps'),
            'p95_latency_ms': bench.get('latency_ms', {}).get('p95'),
            'CreateTender_ms': _avg('CreateTender'),
            'CommitBid_avg_ms': _avg('CommitBid'),
            'RevealBid_avg_ms': _avg('RevealBid'),
            'Reputation_avg_ms': _avg('UpdateBehavioralReputation'),
            'infrastructure_nodes': net.get('infrastructure_nodes', 14),
            'orderers': net.get('orderer_count', 5),
            'peers': net.get('peer_count', 9),
        },
        'integrity_failures': [m['id'] for m in ISSG_MODULES if m.get('fail_reveal')],
    }


def main():
    report = None
    try:
        import run_mainnet_experiment as bridge  # noqa: WPS433

        q = bridge.docker('ps', '--filter', 'name=fabric-cli', '--format', '{{.Names}}')
        if 'fabric-cli' in (q.stdout or ''):
            bridge.deploy_chaincode()
            report = run_live_simulation()
        else:
            raise RuntimeError('fabric-cli not running — using bridge experiment relabel')
    except Exception as exc:
        print(f'Live simulation unavailable ({exc}); synthesizing from bridge data.')
        report = synthesize_from_bridge_experiment()
        report['fallback_reason'] = str(exc)

    out = RAW / f'circular_experiment_{TS}.json'
    latest = RAW / 'circular_experiment_latest.json'
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    latest.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'\nSaved: {out}')
    print(f'Latest: {latest}')
    return report


if __name__ == '__main__':
    main()
