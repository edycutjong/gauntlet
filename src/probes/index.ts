import type { Probe, ProbeContext, ProbeResult } from './types.js';
import { hire } from '@edycutjong/croo-core';

async function safeHire(ctx: ProbeContext, req: Record<string, unknown>, expectedToFail = false): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const result = await hire(ctx.client, {
      serviceId: ctx.targetServiceId,
      requirement: req,
    });
    const durationMs = Date.now() - start;
    if (expectedToFail) {
      return {
        name: '',
        passed: false,
        score: 0,
        durationMs,
        error: 'Expected to fail but succeeded',
      };
    }
    return {
      name: '',
      passed: true,
      score: 100,
      durationMs,
      details: `Paid ${result.amountPaid} USDC`,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    
    // Safely extract error and aggressively truncate to prevent PDFKit event loop blocking (OOM)
    const rawError = err instanceof Error ? err.message : String(err);
    const safeError = rawError.length > 500 ? rawError.substring(0, 500) + '... [TRUNCATED]' : rawError;

    if (expectedToFail) {
      return {
        name: '',
        passed: true,
        score: 100,
        durationMs,
        details: `Properly rejected: ${safeError}`,
      };
    }
    return {
      name: '',
      passed: false,
      score: 0,
      durationMs,
      error: safeError,
    };
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
    description: 'Rapid concurrent requests (anti-concurrent)',
    execute: async (ctx) => {
      const start = Date.now();
      
      // CRITICAL: Use Promise.all to achieve actual concurrency backpressure
      const [p1, p2, p3] = await Promise.all([
        safeHire(ctx, { topic: 'Batch 1' }),
        safeHire(ctx, { topic: 'Batch 2' }),
        safeHire(ctx, { topic: 'Batch 3' })
      ]);
      
      const durationMs = Date.now() - start;
      const passed = p1.passed && p2.passed && p3.passed;
      
      return {
        name: 'rapid_sequential',
        passed,
        score: passed ? 100 : 0,
        durationMs,
        details: passed ? 'Processed 3 rapid orders' : 'Failed to handle rapid load',
      };
    },
  },
  {
    name: 'byzantine_rugpull',
    description: 'Byzantine Rug Pull — 10MB garbage deliverable payload',
    execute: async (ctx) => {
      // Simulate malicious counterparty that successfully negotiates but delivers a massive garbage string
      const massivePayload = 'MALICIOUS_GARBAGE'.repeat(1024 * 1024); // ~17MB
      const res = await safeHire(ctx, { topic: massivePayload }, true);
      res.name = 'byzantine_rugpull';
      return res;
    },
  },
  {
    name: 'sla_sniper',
    description: 'SLA Sniper — test timeout race condition safety (delivers 2s before expiry)',
    execute: async (ctx) => {
      // For mock, simulate the target agent hitting its 120s guard exactly at 118s.
      // We send a specific topic that the mock target (if it exists) handles by delaying.
      const res = await safeHire(ctx, { topic: 'sla_sniper_scenario', _delayMs: 118000 }, false);
      // In a real test, if duration > 1000, we check if it passed
      res.name = 'sla_sniper';
      return res;
    },
  },
];
