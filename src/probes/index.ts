import type { Probe, ProbeContext, ProbeResult } from './types.js';
import { hire } from '@edycutjong/croo-core';



async function safeHire(ctx: ProbeContext, req: Record<string, unknown>, expectedToFail = false, timeoutMs = 25000): Promise<ProbeResult> {
  const start = Date.now();
  let timerId: NodeJS.Timeout | undefined;

  try {
    const hirePromise = hire(ctx.client, {
      serviceId: ctx.targetServiceId,
      requirement: req,
    });

    // Architecture: Prevent Escrow Griefing/Event Loop Stalls
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error(`Probe Timeout: Target agent stalled for >${timeoutMs}ms`)), timeoutMs);
    });

    // Await the race
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await Promise.race([hirePromise, timeoutPromise]) as any;
    if (timerId) clearTimeout(timerId);

    const durationMs = Date.now() - start;
    if (expectedToFail) {
      return { name: '', passed: false, score: 0, durationMs, error: 'Expected to fail but succeeded' };
    }
    return { name: '', passed: true, score: 100, durationMs, details: `Paid ${result?.amountPaid || 'unknown'} USDC` };
  } catch (err: unknown) {
    if (timerId) clearTimeout(timerId);
    const durationMs = Date.now() - start;

    const rawError = err instanceof Error ? err.message : String(err);
    const safeError = rawError.length > 500 ? rawError.substring(0, 500) + '... [TRUNCATED]' : rawError;

    if (expectedToFail) {
      return { name: '', passed: true, score: 100, durationMs, details: `Properly rejected: ${safeError}` };
    }
    return { name: '', passed: false, score: 0, durationMs, error: safeError };
  }
}

export const probes: Probe[] = [
  {
    name: 'happy',
    description: 'Happy path — normal valid payload',
    execute: async (ctx) => {
      const res = await safeHire(ctx, { topic: 'ZKP Validation', depth: 'standard' });
      res.name = 'happy';
      return res;
    },
  },
  {
    name: 'latency',
    description: 'Latency baseline — simple quick request',
    execute: async (ctx) => {
      const res = await safeHire(ctx, { topic: 'Ping', depth: 'quick' });
      res.name = 'latency';
      if (res.passed && res.durationMs > 5000) {
        res.passed = false;
        res.score = 50;
        res.error = `Latency too high: ${res.durationMs}ms`;
      }
      return res;
    },
  },
  {
    name: 'malformed',
    description: 'Malformed payload — missing fields',
    execute: async (ctx) => {
      const res = await safeHire(ctx, { invalidField: true }, true);
      res.name = 'malformed';
      return res;
    },
  },
  {
    name: 'oversized',
    description: 'Oversized payload — 100kb requirement',
    execute: async (ctx) => {
      const largeTopic = 'A'.repeat(100 * 1024);
      const res = await safeHire(ctx, { topic: largeTopic }, true);
      res.name = 'oversized';
      return res;
    },
  },
  {
    name: 'empty',
    description: 'Empty payload',
    execute: async (ctx) => {
      const res = await safeHire(ctx, {}, true);
      res.name = 'empty';
      return res;
    },
  },
  {
    name: 'sla',
    description: 'SLA timeout emulation',
    execute: async (ctx) => {
      // For mock, we'll just simulate a delayed requirement that fails
      const res = await safeHire(ctx, { topic: 'timeout_test_scenario' }, true);
      res.name = 'sla';
      return res;
    },
  },
  {
    name: 'rapid_sequential',
    description: 'Rapid sequential requests (safe anti-concurrent)',
    execute: async (ctx) => {
      const start = Date.now();
      
      // CRITICAL ARCHITECTURE FIX: Do NOT use Promise.all for hire() calls.
      // CROO AA Wallets suffer nonce collisions on concurrent PayOrder calls.
      // We must execute rapidly but strictly sequentially to respect bundler constraints.
      const p1 = await safeHire(ctx, { topic: 'Batch 1' });
      const p2 = await safeHire(ctx, { topic: 'Batch 2' });
      const p3 = await safeHire(ctx, { topic: 'Batch 3' });
      
      const durationMs = Date.now() - start;
      const passed = p1.passed && p2.passed && p3.passed;
      
      return {
        name: 'rapid_sequential',
        passed,
        score: passed ? 100 : 0,
        durationMs,
        details: passed ? 'Processed 3 rapid orders sequentially' : 'Failed to handle rapid load',
      };
    },
  },
  {
    name: 'byzantine_rugpull',
    description: 'Byzantine Rug Pull — 500KB garbage deliverable payload',
    execute: async (ctx) => {
      // Self-OOM Prevention: 500KB is sufficient to trigger adversarial limits
      // on target agents without crashing Gauntlet's own V8 heap during JSON serialization.
      const massivePayload = 'MALICIOUS_GARBAGE'.repeat(30 * 1024); // ~500KB
      const res = await safeHire(ctx, { topic: massivePayload }, true);
      res.name = 'byzantine_rugpull';
      return res;
    },
  },
  {
    name: 'sla_sniper',
    description: 'SLA Sniper — test timeout race condition safety (delivers 2s before expiry)',
    execute: async (ctx) => {
      // Pass a custom timeoutMs of 125000 (125s) to allow the 118s delay to complete
      const res = await safeHire(ctx, { topic: 'sla_sniper_scenario', _delayMs: 118000 }, false, 125000);
      res.name = 'sla_sniper';
      return res;
    },
  },
];
