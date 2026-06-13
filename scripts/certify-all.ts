import { isMockMode, makeClient } from '@edycutjong/croo-core';
import { runGauntlet } from '../src/runner.js';
import { composeScorecardPdf } from '../src/composer.js';

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ⚔️  Gauntlet Cross-Certification        ║');
  console.log(`║  Mode: ${isMockMode() ? '🧪 MOCK' : '🔴 LIVE'}                              ║`);
  console.log('╚══════════════════════════════════════════╝');

  // We set mock mode so that the probes use mockHire against the target services
  process.env.CROO_MOCK = 'true';
  const client = makeClient('croo_sk_mock_gauntlet');

  const targets = [
    'svc_maestro_orchestrator',
    'svc_summon_human',
    'svc_litmus_grade'
  ];

  for (const target of targets) {
    console.log(`\n\n🎯 Cross-Certifying: ${target}`);
    console.log(`--------------------------------------------------`);
    const scorecard = await runGauntlet({ client, targetServiceId: target });
    
    console.log(`\n✅ Certification Complete for ${target}`);
    console.log(`Score: ${scorecard.totalScore}% (${scorecard.passedCount}/${scorecard.totalProbes} passed)`);

    const pdfBuffer = await composeScorecardPdf(scorecard);
    const pdfUrl = await client.uploadFile(pdfBuffer, `scorecard_${target}_${Date.now()}.pdf`);
    console.log(`📄 PDF Scorecard: ${pdfUrl}`);
  }

  console.log('\n[certify-all] All targets certified.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[certify-all] Fatal error:', err);
  process.exit(1);
});
