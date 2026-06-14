import { describe, it, expect, vi } from 'vitest';
import { runGauntlet } from '../src/runner.js';
import { probes } from '../src/probes/index.js';

describe('Gauntlet Runner', () => {
  it('runs all probes and aggregates scores', async () => {
    // Mock the probes
    for (const probe of probes) {
      vi.spyOn(probe, 'execute').mockResolvedValue({
        name: probe.name,
        passed: true,
        score: 100,
        durationMs: 100,
        details: 'Mock passed',
      });
    }

    const scorecard = await runGauntlet({
      targetServiceId: 'svc_target',
      client: {},
    });

    expect(scorecard.targetServiceId).toBe('svc_target');
    expect(scorecard.totalScore).toBe(100);
    expect(scorecard.passedCount).toBe(probes.length);
    expect(scorecard.totalProbes).toBe(probes.length);
    expect(scorecard.results).toHaveLength(probes.length);
  });

  it('calculates average score correctly', async () => {
    let i = 0;
    for (const probe of probes) {
      vi.spyOn(probe, 'execute').mockResolvedValue({
        name: probe.name,
        passed: i % 2 === 0,
        score: i % 2 === 0 ? 100 : 0,
        durationMs: 100,
        error: i % 2 === 0 ? undefined : (i === 1 ? undefined : 'Failed'),
      });
      i++;
    }

    const scorecard = await runGauntlet({
      targetServiceId: 'svc_target',
      client: {},
    });

    // 9 probes. Even index: 0, 2, 4, 6, 8 (5 probes) = 500. 500 / 9 = 56
    expect(scorecard.totalScore).toBe(Math.round(500 / 9));
    expect(scorecard.passedCount).toBe(5);
  });

  it('triggers SLA cascade defense when elapsed time exceeds budget', async () => {
    let mockNow = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow);
    
    for (const probe of probes) {
      vi.spyOn(probe, 'execute').mockImplementation(async () => {
        mockNow += 300_000; // Fast forward time
        return { name: probe.name, passed: true, score: 100, durationMs: 100 };
      });
    }

    const scorecard = await runGauntlet({ targetServiceId: 'svc', client: {} });
    expect(scorecard.results.some(r => r.error?.includes('Aborted: Gauntlet global SLA protection engaged'))).toBe(true);
    
    vi.restoreAllMocks();
  });

  it('handles catastrophic internal failures in probes', async () => {
    const probe = probes[0];
    vi.spyOn(probe, 'execute').mockRejectedValueOnce(new Error('Internal Crash'));
    const scorecard = await runGauntlet({ targetServiceId: 'svc', client: {} });
    expect(scorecard.results[0].error).toMatch(/Internal probe execution crashed/);
  });
});
