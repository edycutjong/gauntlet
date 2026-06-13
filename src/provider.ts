import { runProvider } from '@edycutjong/croo-core';
import type { Order, Deliverable, Event } from '@edycutjong/croo-core';
import { runGauntlet } from './runner.js';
import type { GauntletScorecard } from './runner.js';
import { composeScorecardPdf } from './composer.js';

// CONCURRENCY GUARD: Prevent OOM and event loop starvation under heavy load
class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private readonly max: number) {}
  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.queue.push(resolve));
  }
  release(): void {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      if (resolve) resolve();
    } else {
      this.active--;
    }
  }
}

// Allow max 3 concurrent certification runs to preserve memory and CPU
const certLock = new Semaphore(3);

export function startGauntletProvider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  serviceId: string,
) {
  return runProvider<GauntletScorecard>(client, {
    serviceMatch: (event: Event) => {
      if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
      return 'service_id' in event && (event as Record<string, unknown>).service_id === serviceId;
    },

    work: async (order: Order): Promise<Deliverable<GauntletScorecard>> => {
      await certLock.acquire();
      try {
        if (!order || !order.requirement || typeof order.requirement !== 'object' || Array.isArray(order.requirement)) {
          throw new Error('Invalid requirement format: Expected JSON object');
        }

        const input = order.requirement as Record<string, unknown>;
        if (typeof input.targetServiceId !== 'string' || !input.targetServiceId) {
          throw new Error('Missing or invalid required field: targetServiceId');
        }

        // Security: Sanitize target ID to prevent Path Traversal / Object Key Injection
        const safeTargetId = input.targetServiceId.replace(/[^a-zA-Z0-9_-]/g, '_');

        console.log(`[gauntlet] Received certification order for: ${safeTargetId}`);

        const scorecard = await runGauntlet({
          client,
          targetServiceId: safeTargetId,
        });

        console.log(`[gauntlet] Generating PDF scorecard...`);
        const pdfBuffer = await composeScorecardPdf(scorecard);

        // FIXED: String interpolation syntax
        const pdfUrl = await client.uploadFile(pdfBuffer, `scorecard_${safeTargetId}_${Date.now()}.pdf`);

        console.log(`[gauntlet] Uploaded PDF Scorecard: ${pdfUrl}`);

        // Provide the scorecard as the deliverable
        return { 
          type: 'schema', 
          data: {
            ...scorecard,
            pdfUrl,
          }
        };
      } finally {
        certLock.release();
      }
    },

    // A full gauntlet run takes several minutes (sla_sniper alone is ~118s).
    // Extended to 10m SLA guard to prevent self-abort.
    slaGuardMs: 600_000, 
  });
}
