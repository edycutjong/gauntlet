/**
 * Gauntlet — Entry point (stub).
 *
 * Gauntlet is deferred to Phase 4 (Days 19-23).
 * This is a placeholder that validates the project scaffolding.
 *
 * Required env vars:
 * - CROO_SDK_KEY
 * - GAUNTLET_SERVICE_ID
 *
 * Optional:
 * - CROO_MOCK=true
 */

import { isMockMode, makeClient } from '@edycutjong/croo-core';
import { startGauntletProvider } from './provider.js';

export * from './provider.js';
export * from './runner.js';
export * from './probes/index.js';

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ⚔️  Gauntlet — Certification Agent       ║');
  console.log('║  7-probe adversarial testing              ║');
  console.log(`║  Mode: ${isMockMode() ? '🧪 MOCK' : '🔴 LIVE (Base Mainnet)'}              ║`);
  console.log('╚══════════════════════════════════════════╝');

  const sdkKey = process.env.CROO_SDK_KEY;
  if (!sdkKey && !isMockMode()) {
    throw new Error('CROO_SDK_KEY is required unless CROO_MOCK=true');
  }

  const client = makeClient(sdkKey || 'croo_sk_mock_gauntlet');
  const serviceId = process.env.GAUNTLET_SERVICE_ID ?? 'svc_gauntlet_certifier';

  console.log(`[gauntlet] Starting provider on ${serviceId}...`);
  await startGauntletProvider(client, serviceId);
}

// Only auto-start if this file is run directly
if (import.meta.url.endsWith(process.argv[1])) {
  main().catch((err) => {
    console.error('[gauntlet] Fatal error:', err);
    process.exit(1);
  });
}
