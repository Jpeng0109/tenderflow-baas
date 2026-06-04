import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';
import { peerFqdn, PEER_ORGS } from '../config/topology.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = process.env.COMPOSE_PROJECT_DIR
  || path.resolve(__dirname, '../../..');

const CA_REGISTRY = {
  'centralbank.gov': {
    url: 'https://localhost:7054',
    caName: 'ca-centralbank',
    affiliation: 'centralbank.peer',
  },
  'liquidity-bankA.com': {
    url: 'https://localhost:8054',
    caName: 'ca-banka',
    affiliation: 'banka.peer',
  },
  'liquidity-bankB.com': {
    url: 'https://localhost:9054',
    caName: 'ca-bankb',
    affiliation: 'bankb.peer',
  },
};

function caTlsCert(orgDomain) {
  return path.join(
    WORKSPACE_ROOT,
    'organizations/peerOrganizations',
    orgDomain,
    'ca',
    `ca.${orgDomain}-cert.pem`,
  );
}

/**
 * Enroll a dynamic peer via Fabric CA Node SDK.
 */
export async function enrollDynamicPeer({ orgDomain, peerIndex }) {
  if (process.env.CLOUD_DEMO_MODE === 'true') {
    throw new Error('Fabric CA enrollment is unavailable in cloud demo mode');
  }
  const { default: FabricCAServices } = await import('fabric-ca-client');
  const org = PEER_ORGS[orgDomain];
  const caCfg = CA_REGISTRY[orgDomain];
  if (!org || !caCfg) throw new Error(`No CA config for ${orgDomain}`);

  const fqdn = peerFqdn(orgDomain, peerIndex);
  const tlsCert = caTlsCert(orgDomain);
  if (!fs.existsSync(tlsCert)) {
    throw new Error(`CA TLS cert missing at ${tlsCert}. Run init-fabric-ca.sh`);
  }

  const ca = new FabricCAServices({
    url: caCfg.url,
    caName: caCfg.caName,
    tlsOptions: { trustedRoots: [fs.readFileSync(tlsCert)] },
  });

  const enrollId = `peer${peerIndex}`;
  const enrollSecret = `peer${peerIndex}pw`;
  const peerDir = path.join(
    WORKSPACE_ROOT,
    'organizations/peerOrganizations',
    orgDomain,
    'peers',
    fqdn,
  );
  fs.mkdirSync(path.join(peerDir, 'msp'), { recursive: true });

  try {
    await ca.register(
      {
        enrollmentID: enrollId,
        enrollmentSecret: enrollSecret,
        role: 'peer',
        affiliation: caCfg.affiliation,
      },
      { enrollmentID: 'admin', enrollmentSecret: 'adminpw' },
    );
  } catch (err) {
    logger.warn(`CA register skipped (may exist): ${err.message}`);
  }

  const enrollment = await ca.enroll({
    enrollmentID: enrollId,
    enrollmentSecret: enrollSecret,
    csr: { hosts: [fqdn, 'localhost'] },
  });

  fs.writeFileSync(
    path.join(peerDir, 'msp', 'signcerts.pem'),
    enrollment.certificate,
  );
  fs.mkdirSync(path.join(peerDir, 'msp', 'keystore'), { recursive: true });
  fs.writeFileSync(
    path.join(peerDir, 'msp', 'keystore', 'priv_sk'),
    enrollment.key.toBytes(),
  );

  logger.info(`CA enrolled dynamic peer ${fqdn}`);
  return {
    fqdn,
    mspId: org.mspId,
    method: 'fabric-ca-sdk',
    mspPath: path.join(peerDir, 'msp'),
  };
}
