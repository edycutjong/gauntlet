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

import { isMockMode } from 'croo-core';

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ⚔️  Gauntlet — Certification Agent       ║');
  console.log('║  7-probe adversarial testing              ║');
  console.log(`║  Mode: ${isMockMode() ? '🧪 MOCK' : '🔴 LIVE (Base Mainnet)'}              ║`);
  console.log('║  Status: STUB — build in Phase 4          ║');
  console.log('╚══════════════════════════════════════════╝');

  // TODO: Phase 4 implementation
  // - Provider loop (accept "certify" orders)
  // - 7 probes (happy, latency, malformed, oversized, empty, SLA, concurrent)
  // - Observer (WS timings)
  // - Scorecard PDF (pdfkit → uploadFile)

  console.log('[gauntlet] Not yet implemented. See BUILD_PLAN.md Phase 4.');
}

main().catch((err) => {
  console.error('[gauntlet] Fatal error:', err);
  process.exit(1);
});
