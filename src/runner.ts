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

  for (const probe of probes) {
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

  const finalScore = Math.round(totalScore / probes.length);
  
  return {
    targetServiceId: ctx.targetServiceId,
    totalScore: finalScore,
    passedCount,
    totalProbes: probes.length,
    timestamp: new Date().toISOString(),
    results,
  };
}
