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

  const GLOBAL_START_MS = Date.now();
  // 5 Min SLA - 30s Buffer for PDF gen & upload = 270,000ms absolute execution budget
  const EXECUTION_TIME_LIMIT_MS = 270_000;

  for (const probe of probes) {
    const elapsedMs = Date.now() - GLOBAL_START_MS;
    
    // SLA CASCADE DEFENSE: Short-circuit if remaining time is insufficient
    if (elapsedMs >= EXECUTION_TIME_LIMIT_MS) {
      console.warn(`[gauntlet] ⚠️ Global SLA limit approaching (${elapsedMs}ms). Aborting remaining probes.`);
      results.push({
        name: probe.name,
        passed: false,
        score: 0,
        durationMs: 0,
        error: `Aborted: Gauntlet global SLA protection engaged to guarantee scorecard delivery.`,
      });
      continue;
    }

    console.log(`[gauntlet] Running probe: ${probe.name} (${probe.description})`);
    
    const probeStartMs = Date.now();
    let result: ProbeResult;

    // ISOLATION: Prevent internal probe crashes from taking down the entire certification pipeline
    try {
      result = await probe.execute(ctx);
    } catch (probeErr: unknown) {
      console.error(`[gauntlet] Catastrophic internal failure in probe ${probe.name}:`, probeErr);
      result = {
        name: probe.name,
        passed: false,
        score: 0,
        durationMs: Date.now() - probeStartMs,
        error: `Internal probe execution crashed: ${String(probeErr).substring(0, 200)}`,
      };
    }

    results.push(result);
    totalScore += result.score;

    if (result.passed) {
      passedCount++;
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
