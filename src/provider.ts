import { runProvider } from '@edycutjong/croo-core';
import type { Order, Deliverable, Event } from '@edycutjong/croo-core';
import { runGauntlet } from './runner.js';
import type { GauntletScorecard } from './runner.js';
import { composeScorecardPdf } from './composer.js';



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
      if (!order || !order.requirement || typeof order.requirement !== 'object' || Array.isArray(order.requirement)) {
        throw new Error('Invalid requirement format: Expected JSON object');
      }

      const input = order.requirement as Record<string, unknown>;
      if (typeof input.targetServiceId !== 'string' || !input.targetServiceId) {
        throw new Error('Missing or invalid required field: targetServiceId');
      }

      console.log(`[gauntlet] Received certification order for: ${input.targetServiceId}`);

      const scorecard = await runGauntlet({
        client,
        targetServiceId: input.targetServiceId,
      });

      console.log(`[gauntlet] Generating PDF scorecard...`);
      const pdfBuffer = await composeScorecardPdf(scorecard);
      // FIXED: String interpolation syntax
      const pdfUrl = await client.uploadFile(pdfBuffer, `scorecard_${input.targetServiceId}_${Date.now()}.pdf`);

      console.log(`[gauntlet] Uploaded PDF Scorecard: ${pdfUrl}`);

      // Provide the scorecard as the deliverable
      return { 
        type: 'schema', 
        data: {
          ...scorecard,
          pdfUrl,
        }
      };
    },

    // A full gauntlet run might take several minutes, use a 5m SLA guard
    slaGuardMs: 300_000, 
  });
}
