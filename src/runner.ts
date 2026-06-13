import type { ProbeContext, ProbeResult } from './probes/types.js';
import { probes } from './probes/index.js';

export interface GauntletScorecard {
  targetServiceId: string;
  totalScore: number;
  passedCount: number;
  totalProbes: number;
  timestamp: string;
  pdfUrl?: string;
  results: ProbeResult[];
}

export async function runGauntlet(ctx: ProbeContext): Promise<GauntletScorecard> {
  const results: ProbeResult[] = [];
  let totalScore = 0;
  let passedCount = 0;

  console.log(`[gauntlet] Starting 7-probe certification for ${ctx.targetServiceId}`);

  // CRITICAL: Reserve 45 seconds for PDF generation and final delivery
  // to ensure Gauntlet never breaches its extended 10m (600,000ms) SLA.
  const MAX_RUNTIME_MS = 555_000; 
  const startTime = Date.now();

  for (const probe of probes) {
    // Global SLA Guard
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.warn(`[gauntlet] ⚠️ Aborting remaining probes to protect Gauntlet's SLA`);
      results.push({ 
        name: probe.name, 
        passed: false, 
        score: 0, 
        durationMs: 0, 
        error: 'Skipped due to SLA safety constraints (target tarpitted)' 
      });
      continue;
    }

    // FIXED: String interpolation syntax
    console.log(`[gauntlet] Running probe: ${probe.name} (${probe.description})`);
    const result = await probe.execute(ctx);
    results.push(result);

    if (result.passed) {
      passedCount++;
      totalScore += result.score;
      console.log(`[gauntlet] ✅ PASS (${result.durationMs}ms): ${result.details || 'OK'}`);
    } else {
      console.log(`[gauntlet] ❌ FAIL (${result.durationMs}ms): ${result.error || 'Failed'}`);
    }
  }

  const finalScore = probes.length > 0 ? Math.round(totalScore / probes.length) : 0;
  
  return {
    targetServiceId: ctx.targetServiceId,
    totalScore: finalScore,
    passedCount,
    totalProbes: probes.length,
    timestamp: new Date().toISOString(),
    results,
  };
}
