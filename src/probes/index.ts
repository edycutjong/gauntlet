import type { Probe, ProbeContext, ProbeResult } from './types.js';
import { hire } from '@edycutjong/croo-core';

// HOISTED: Prevent V8 GC thrashing by allocating this 17MB string exactly once in module memory
const BYZANTINE_PAYLOAD = 'MALICIOUS_GARBAGE'.repeat(1024 * 1024);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function safeHire(ctx: ProbeContext, req: Record<string, unknown>, expectedToFail = false): Promise<ProbeResult> {
  const start = Date.now();
  // Do not retry adversarial probes to preserve true timeout boundaries
  const maxRetries = expectedToFail ? 0 : 2;
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= maxRetries) {
    let timer: NodeJS.Timeout | undefined;
    try {
      // TARPIT DEFENSE: Absolute timeout envelope (125s safely accommodates sla_sniper's 118s delay)
      const timeoutMs = 125_000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tarpit timeout: Target exceeded ${timeoutMs}ms limit`)), timeoutMs);
      });

      const result = await Promise.race([
        hire(ctx.client, { serviceId: ctx.targetServiceId, requirement: req }),
        timeoutPromise
      ]).finally(() => {
        if (timer) clearTimeout(timer); // CRITICAL: Prevent dangling timers from leaking memory
      });
      
      const durationMs = Date.now() - start;
      if (expectedToFail) {
        return { name: '', passed: false, score: 0, durationMs, error: 'Expected to fail but succeeded' };
      }
      return {
        name: '',
        passed: true,
        score: 100,
        durationMs,
        details: `Paid ${result.amountPaid} USDC`,
      };

    } catch (err: unknown) {
      lastErr = err;
      const isTimeoutError = err instanceof Error && err.message.includes("Tarpit timeout");

      // Transient network fault exponential backoff (do not retry absolute timeouts)
      if (attempt < maxRetries && !isTimeoutError) {
        attempt++;
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s...
        console.warn(`[gauntlet] Transient error, retrying in ${backoffMs}ms (Attempt ${attempt}/${maxRetries})...`);
        await delay(backoffMs);
        continue;
      }
      break;
    }
  }

  const durationMs = Date.now() - start;
  const rawError = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const safeError = rawError.length > 500 ? rawError.substring(0, 500) + '... [TRUNCATED]' : rawError;

  if (expectedToFail) {
    return { name: '', passed: true, score: 100, durationMs, details: `Properly rejected: ${safeError}` };
  }
  return { name: '', passed: false, score: 0, durationMs, error: safeError };
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
      // Uses the hoisted singleton payload
      const res = await safeHire(ctx, { topic: BYZANTINE_PAYLOAD }, true);
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
