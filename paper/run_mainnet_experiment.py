#!/usr/bin/env python3
"""
TENDERFLOW mainnet experiment — deploy chaincode, run Ma'anshan simulation,
collect real metrics, save raw data for paper figures.
"""

import json
import os
import re
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent / 'raw-data'
RAW.mkdir(exist_ok=True)

CHANNEL = os.environ.get('CHANNEL_ID', 'fx-bridge-channel')
CC_NAME = 'tenderflow'
CC_VERSION = '1.0'
CC_SEQUENCE = '1'
CC_LABEL = 'tenderflow_1'
TENDER_ID = 'MAS-2024-BRIDGE-001'
NETWORK = 'fx-bridge_fx_bridge'
ORDERER = 'orderer1.clearing-raft.org:7050'
ORDERER_CA = '/etc/hyperledger/fabric/organizations/ordererOrganizations/clearing-raft.org/orderers/orderer1.clearing-raft.org/msp/tlscacerts/tlsca.clearing-raft.org-cert.pem'

ORGS = [
    {'domain': 'centralbank.gov', 'msp': 'CentralBankMSP', 'peer': 'peer0.centralbank.gov', 'port': 7051},
    {'domain': 'liquidity-bankA.com', 'msp': 'LiquidityBankAMSP', 'peer': 'peer0.liquidity-bankA.com', 'port': 9051},
    {'domain': 'liquidity-bankB.com', 'msp': 'LiquidityBankBMSP', 'peer': 'peer0.liquidity-bankB.com', 'port': 11051},
]

BIDDERS = [
    {'id': 'Bidder-A', 'verified': 0.95, 'scenario': 'static_winner'},
    {'id': 'Bidder-B', 'verified': 0.95, 'scenario': 'breach_penalty'},
    {'id': 'Bidder-C', 'verified': 0.78, 'scenario': 'dynamic_winner'},
    {'id': 'Bidder-D', 'verified': 0.82, 'scenario': 'stable'},
    {'id': 'Bidder-E', 'verified': 0.80, 'scenario': 'mid'},
    {'id': 'Bidder-F', 'verified': 0.88, 'scenario': 'strong_cert'},
    {'id': 'Bidder-G', 'verified': 0.76, 'scenario': 'new_entrant'},
    {'id': 'Bidder-H', 'verified': 0.74, 'scenario': 'new_entrant'},
]

TS = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')


def run(cmd, check=False, timeout=300):
    if isinstance(cmd, str):
        cmd = ['powershell', '-NoProfile', '-Command', cmd]
    print(f'  $ {" ".join(cmd[-1:] if len(cmd) > 2 else cmd)}')
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if check and r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout)
    return r


def docker(*args, timeout=300):
    return run(['docker', *args], timeout=timeout)


def fabric_exec(org_idx, *peer_args):
    org = ORGS[org_idx]
    admin_msp = f'/etc/hyperledger/fabric/organizations/peerOrganizations/{org["domain"]}/users/Admin@{org["domain"]}/msp'
    tls_ca = f'/etc/hyperledger/fabric/organizations/peerOrganizations/{org["domain"]}/peers/{org["peer"]}/tls/ca.crt'
    cmd = [
        'docker', 'exec', 'fabric-cli', 'env',
        f'CORE_PEER_LOCALMSPID={org["msp"]}',
        f'CORE_PEER_ADDRESS={org["peer"]}:{org["port"]}',
        f'CORE_PEER_MSPCONFIGPATH={admin_msp}',
        'CORE_PEER_TLS_ENABLED=true',
        f'CORE_PEER_TLS_ROOTCERT_FILE={tls_ca}',
        'peer', *peer_args,
    ]
    return run(cmd, timeout=120)


def block_height():
    r = docker('exec', 'peer0.centralbank.gov', 'peer', 'channel', 'getinfo', '-c', CHANNEL)
    m = re.search(r'"height":(\d+)', r.stdout + r.stderr)
    return int(m.group(1)) if m else 0


def deploy_chaincode():
    print('\n=== Deploy tenderflow chaincode (CCAAS) ===')
    r = fabric_exec(0, 'lifecycle', 'chaincode', 'querycommitted', '-C', CHANNEL, '--name', CC_NAME)
    if 'Version:' in (r.stdout + r.stderr) and CC_VERSION in (r.stdout + r.stderr):
        print('  Chaincode already committed — ensuring CCAAS server is up.')
        _ensure_ccaas_server()
        return

    ccaas_dir = ROOT / 'chaincode' / 'tenderflow' / 'ccaas'
    pkg = ROOT / 'chaincode' / 'tenderflow_ccaas.tar.gz'
    docker(
        'run', '--rm', f'-v={ROOT}:/work', '-w=/work/chaincode/tenderflow/ccaas',
        'alpine', 'sh', '-c', 'tar czf code.tar.gz connection.json',
    )
    docker(
        'run', '--rm', f'-v={ROOT}:/work', '-w=/work/chaincode/tenderflow/ccaas',
        'alpine', 'sh', '-c', 'tar czf /work/chaincode/tenderflow_ccaas.tar.gz metadata.json code.tar.gz',
    )
    docker('cp', str(pkg), 'fabric-cli:/tmp/tenderflow_ccaas.tar.gz')
    for org in ORGS:
        fabric_exec(ORGS.index(org), 'lifecycle', 'chaincode', 'install', '/tmp/tenderflow_ccaas.tar.gz')

    pkg_ids = {}
    for i, org in enumerate(ORGS):
        r = fabric_exec(i, 'lifecycle', 'chaincode', 'queryinstalled')
        m = re.search(r'Package ID: (\S+), Label: ' + CC_LABEL, r.stdout + r.stderr)
        pkg_ids[org['msp']] = m.group(1) if m else ''
        print(f'  {org["msp"]} package: {pkg_ids[org["msp"]]}')

    for i, org in enumerate(ORGS):
        pid = pkg_ids[org['msp']]
        fabric_exec(
            i, 'lifecycle', 'chaincode', 'approveformyorg',
            '-o', ORDERER, '--channelID', CHANNEL, '--name', CC_NAME,
            '--version', CC_VERSION, '--package-id', pid, '--sequence', CC_SEQUENCE,
            '--tls', '--cafile', ORDERER_CA,
        )

    tls_flags = []
    for org in ORGS:
        tls = f'/etc/hyperledger/fabric/organizations/peerOrganizations/{org["domain"]}/peers/{org["peer"]}/tls/ca.crt'
        tls_flags += ['--peerAddresses', f'{org["peer"]}:{org["port"]}', '--tlsRootCertFiles', tls]

    fabric_exec(
        0, 'lifecycle', 'chaincode', 'commit',
        '-o', ORDERER, '--channelID', CHANNEL, '--name', CC_NAME,
        '--version', CC_VERSION, '--sequence', CC_SEQUENCE,
        '--tls', '--cafile', ORDERER_CA, *tls_flags,
    )
    _ensure_ccaas_server(pkg_ids.get(ORGS[0]['msp'], ''))
    print('  Chaincode committed (CCAAS).')


def _ensure_ccaas_server(package_id=''):
    if not package_id:
        r = fabric_exec(0, 'lifecycle', 'chaincode', 'queryinstalled')
        m = re.search(r'Package ID: (\S+), Label: ' + CC_LABEL, r.stdout + r.stderr)
        package_id = m.group(1) if m else ''
    if not package_id:
        return
    docker('rm', '-f', 'tenderflow_ccaas')
    docker(
        'build', '-t', 'tenderflow_ccaas:latest', str(ROOT / 'chaincode' / 'tenderflow'),
        timeout=600,
    )
    docker(
        'run', '-d', '--name', 'tenderflow_ccaas', '--network', NETWORK,
        '-e', 'CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999',
        '-e', f'CORE_CHAINCODE_ID_NAME={package_id}',
        '-p', '9999:9999', 'tenderflow_ccaas:latest',
    )
    time.sleep(4)


def invoke(org_idx, function, payload, measure=True, args_list=None):
    org = ORGS[org_idx]
    if args_list is not None:
        args = json.dumps({'function': function, 'Args': args_list})
    else:
        payload_str = payload if isinstance(payload, str) else json.dumps(payload_dict := payload, separators=(',', ':'))
        args = json.dumps({'function': function, 'Args': [payload_str]})
    tls_flags = []
    for o in ORGS:
        tls = f'/etc/hyperledger/fabric/organizations/peerOrganizations/{o["domain"]}/peers/{o["peer"]}/tls/ca.crt'
        tls_flags += ['--peerAddresses', f'{o["peer"]}:{o["port"]}', '--tlsRootCertFiles', tls]

    t0 = time.perf_counter()
    r = fabric_exec(
        org_idx, 'chaincode', 'invoke',
        '-o', ORDERER, '-C', CHANNEL, '-n', CC_NAME,
        '-c', args, '--tls', '--cafile', ORDERER_CA, *tls_flags,
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000
    ok = 'status:200' in (r.stdout + r.stderr) or 'VALID' in (r.stdout + r.stderr) or (
        r.returncode == 0 and 'Error' not in (r.stdout + r.stderr)
    )
    return {'ok': ok, 'latency_ms': round(elapsed_ms, 2), 'function': function, 'payload': payload if args_list is None else args_list}


def query(org_idx, function, *args):
    arg_json = json.dumps({'function': function, 'Args': list(args)})
    r = fabric_exec(org_idx, 'chaincode', 'query', '-C', CHANNEL, '-n', CC_NAME, '-c', arg_json)
    return (r.stdout + r.stderr).strip()


def run_maanshan_simulation():
    print('\n=== Ma\'anshan tendering simulation ===')
    txs = []
    h0 = block_height()

    tender_payload = {
        'tender_id': TENDER_ID,
        'project_name': "Ma'anshan Yangtze River Bridge",
        'rfp_cid': 'ipfs://QmMaanshanRFP2024Bridge3248mSteelTruss',
        'bid_bond_pct': 2.0,
        'deadline': '2024-12-31T23:59:59Z',
    }
    txs.append(invoke(0, 'CreateTender', tender_payload))
    time.sleep(2)

    commits = {}
    for b in BIDDERS:
        bh = f'sha256:{b["id"]}-mas-bridge-boq-2024'
        commits[b['id']] = bh
        cp = {'tender_id': TENDER_ID, 'bidder_id': b['id'], 'bid_hash': bh}
        txs.append(invoke(1, 'CommitBid', cp))
        time.sleep(0.5)

    for b in BIDDERS:
        txs.append(invoke(0, 'InitReputation', None, args_list=[b['id'], str(b['verified'])]))
        time.sleep(0.3)

    # Bidder-B breach: reveal with wrong hash
    txs.append(invoke(1, 'RevealBid', {
        'tender_id': TENDER_ID, 'bidder_id': 'Bidder-B',
        'file_cid': 'ipfs://QmWRONGHASH_breach_simulation',
    }))
    time.sleep(1)

    # Others reveal correctly (hash prefix match)
    for b in BIDDERS:
        if b['id'] == 'Bidder-B':
            continue
        txs.append(invoke(1, 'RevealBid', {
            'tender_id': TENDER_ID, 'bidder_id': b['id'],
            'file_cid': commits[b['id']],
        }))
        time.sleep(0.5)

    # Bidder-C: 12 consecutive success reputation updates
    for _ in range(12):
        txs.append(invoke(2, 'UpdateBehavioralReputation', None, args_list=['Bidder-C', 'Success']))
        time.sleep(0.3)

    h1 = block_height()
    reputations = {}
    for b in BIDDERS:
        try:
            reputations[b['id']] = query(0, 'GetReputation', b['id'])
        except Exception:
            reputations[b['id']] = ''

    return {
        'transactions': txs,
        'block_height_before': h0,
        'block_height_after': h1,
        'blocks_produced': h1 - h0,
        'reputations': reputations,
    }


def benchmark_throughput(n=50):
    print(f'\n=== Throughput benchmark ({n} invokes) ===')
    latencies = []
    t0 = time.perf_counter()
    h0 = block_height()
    for i in range(n):
        r = invoke(1, 'CommitBid', {
            'tender_id': TENDER_ID,
            'bidder_id': f'Bench-{i % 8}',
            'bid_hash': f'sha256:bench-{i}-{TS}',
        }, measure=True)
        latencies.append(r['latency_ms'])
        if i % 10 == 9:
            time.sleep(1)
    elapsed = time.perf_counter() - t0
    h1 = block_height()
    ok_count = sum(1 for l in latencies if l)
    return {
        'invoke_count': n,
        'elapsed_sec': round(elapsed, 3),
        'tps': round(n / elapsed, 2) if elapsed > 0 else 0,
        'blocks_before': h0,
        'blocks_after': h1,
        'latency_ms': {
            'min': round(min(latencies), 2),
            'max': round(max(latencies), 2),
            'avg': round(sum(latencies) / len(latencies), 2),
            'p95': round(sorted(latencies)[int(len(latencies) * 0.95) - 1], 2),
        },
        'latencies_raw': latencies,
    }


def collect_network_snapshot():
    print('\n=== Network snapshot ===')
    r = docker('ps', '--filter', 'name=orderer', '--format', '{{.Names}}')
    orderers = [x for x in r.stdout.splitlines() if x.strip()]
    r = docker('ps', '--filter', 'name=peer', '--format', '{{.Names}}')
    peers = [x for x in r.stdout.splitlines() if x.strip()]
    height = block_height()

    explorer = {}
    try:
        with urllib.request.urlopen('http://localhost:4100/api/explorer/telemetry', timeout=5) as resp:
            explorer = json.loads(resp.read())
    except Exception as e:
        explorer = {'error': str(e)}

    return {
        'timestamp_utc': datetime.now(timezone.utc).isoformat(),
        'channel_id': CHANNEL,
        'orderer_count': len(orderers),
        'peer_count': len(peers),
        'orderers': orderers,
        'peers': peers,
        'infrastructure_nodes': len(orderers) + len(peers),
        'block_height': height,
        'fabric_version': '2.5.12',
        'state_database': 'CouchDB',
        'consensus': 'etcd/Raft (5 orderers)',
        'explorer_api': explorer,
    }


def compute_scenario_analysis(reputations_raw):
    """Parse reputation JSON strings into scenario comparison."""
    scores = {}
    for bid, raw in reputations_raw.items():
        try:
            m = re.search(r'\{.*\}', raw, re.DOTALL)
            if m:
                rec = json.loads(m.group())
                scores[bid] = rec
        except Exception:
            scores[bid] = {}

    static_winner = max(BIDDERS, key=lambda b: b['verified'])
    dynamic_winner = max(
        (b for b in BIDDERS if b['id'] != 'Bidder-B'),
        key=lambda b: scores.get(b['id'], {}).get('total_score', 0),
        default=BIDDERS[2],
    )
    bidder_b = scores.get('Bidder-B', {})
    return {
        'scenario1_static_winner': static_winner['id'],
        'scenario1_static_verified_rep': static_winner['verified'],
        'scenario2_dynamic_winner': dynamic_winner['id'],
        'scenario2_dynamic_total_score': scores.get(dynamic_winner['id'], {}).get('total_score'),
        'bidder_b_total_after_breach': bidder_b.get('total_score'),
        'bidder_b_behavioral_after_breach': bidder_b.get('behavioral_reputation'),
        'bidder_b_filtered': bidder_b.get('total_score', 1) < 0.75,
        'all_scores': scores,
    }


def main():
    report = {
        'experiment_id': f'mainnet_{TS}',
        'project': "Ma'anshan Yangtze River Bridge TENDERFLOW",
    }

    try:
        q = docker('ps', '--filter', 'name=fabric-cli', '--format', '{{.Names}}')
        if 'fabric-cli' not in (q.stdout or ''):
            raise RuntimeError('fabric-cli container not running')

        deploy_chaincode()
        report['simulation'] = run_maanshan_simulation()
        report['benchmark'] = benchmark_throughput(30)
        report['network'] = collect_network_snapshot()
        report['scenario_analysis'] = compute_scenario_analysis(
            report['simulation'].get('reputations', {})
        )
    except Exception as e:
        report['error'] = str(e)
        report['network'] = collect_network_snapshot()
        print(f'ERROR: {e}')

    out = RAW / f'experiment_{TS}.json'
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    latest = RAW / 'experiment_latest.json'
    latest.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'\nRaw data saved: {out}')
    print(f'Latest symlink:   {latest}')
    return report


if __name__ == '__main__':
    main()
