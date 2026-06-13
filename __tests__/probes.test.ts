import { describe, it, expect, vi, beforeEach } from 'vitest';
import { probes } from '../src/probes/index.js';
import type { ProbeContext } from '../src/probes/types.js';
import * as crooCore from '@edycutjong/croo-core';
import type { HireResult } from '@edycutjong/croo-core';

vi.mock('@edycutjong/croo-core', () => ({
  hire: vi.fn(),
}));

describe('Gauntlet Probes', () => {
  let ctx: ProbeContext;

  beforeEach(() => {
    ctx = {
      targetServiceId: 'svc_test_agent',
      client: {},
    };
    vi.clearAllMocks();
  });

  it('happy probe passes when hire succeeds', async () => {
    vi.mocked(crooCore.hire).mockResolvedValue({ amountPaid: '1.0' } as unknown as HireResult);
    const probe = probes.find(p => p.name === 'happy')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
    expect(res.score).toBe(100);
  });

  it('latency probe fails if duration > 5000ms', async () => {
    vi.mocked(crooCore.hire).mockImplementation(async () => {
      // simulate long delay
      vi.setSystemTime(Date.now() + 6000);
      return { amountPaid: '1.0' } as unknown as HireResult;
    });
    vi.useFakeTimers();
    const probe = probes.find(p => p.name === 'latency')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(false);
    expect(res.error).toMatch(/Latency too high/);
    vi.useRealTimers();
  });

  it('malformed probe passes when hire fails', async () => {
    vi.mocked(crooCore.hire).mockRejectedValue(new Error('Invalid payload'));
    const probe = probes.find(p => p.name === 'malformed')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
    expect(res.details).toMatch(/Properly rejected/);
  });

  it('malformed probe fails when hire succeeds', async () => {
    vi.mocked(crooCore.hire).mockResolvedValue({ amountPaid: '1.0' } as unknown as HireResult);
    const probe = probes.find(p => p.name === 'malformed')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(false);
    expect(res.error).toMatch(/Expected to fail/);
  });
  
  it('oversized probe passes when hire fails', async () => {
    vi.mocked(crooCore.hire).mockRejectedValue(new Error('Payload too large'));
    const probe = probes.find(p => p.name === 'oversized')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
  });

  it('empty probe passes when hire fails', async () => {
    vi.mocked(crooCore.hire).mockRejectedValue(new Error('Empty payload'));
    const probe = probes.find(p => p.name === 'empty')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
  });

  it('sla probe passes when hire fails', async () => {
    vi.mocked(crooCore.hire).mockRejectedValue(new Error('Timeout'));
    const probe = probes.find(p => p.name === 'sla')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
  });

  it('rapid_sequential probe passes when all hires succeed', async () => {
    vi.mocked(crooCore.hire).mockResolvedValue({ amountPaid: '1.0' } as unknown as HireResult);
    const probe = probes.find(p => p.name === 'rapid_sequential')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
    expect(crooCore.hire).toHaveBeenCalledTimes(3);
  });

  it('rapid_sequential probe fails when any hire fails', async () => {
    vi.mocked(crooCore.hire)
      .mockResolvedValueOnce({ amountPaid: '1.0' } as unknown as HireResult)
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ amountPaid: '1.0' } as unknown as HireResult);
    
    const probe = probes.find(p => p.name === 'rapid_sequential')!;
    
    // the backoff in safeHire means the rejected promise retries with 2s delay.
    // wait for the promise to resolve by running all timers
    vi.useFakeTimers();
    const probePromise = probe.execute(ctx);
    await vi.runAllTimersAsync();
    const res = await probePromise;
    vi.useRealTimers();

    expect(res.passed).toBe(false);
  });

  it('byzantine_rugpull probe passes when hire fails', async () => {
    vi.mocked(crooCore.hire).mockRejectedValue(new Error('Payload too large'));
    const probe = probes.find(p => p.name === 'byzantine_rugpull')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
  });

  it('sla_sniper probe passes when hire succeeds', async () => {
    vi.mocked(crooCore.hire).mockResolvedValue({ amountPaid: '1.0' } as unknown as HireResult);
    const probe = probes.find(p => p.name === 'sla_sniper')!;
    const res = await probe.execute(ctx);
    expect(res.passed).toBe(true);
  });
});
