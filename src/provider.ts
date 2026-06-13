import { runProvider } from '@edycutjong/croo-core';
import type { Order, Deliverable, Event } from '@edycutjong/croo-core';
import { runGauntlet } from './runner.js';
import type { GauntletScorecard } from './runner.js';
import { composeScorecardPdf } from './composer.js';

interface GauntletInput {
  targetServiceId: string;
}

export function startGauntletProvider(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  serviceId: string,
) {
  return runProvider<GauntletScorecard>(client, {
    serviceMatch: (event: Event) => {
      return (event as unknown as { service_id?: string }).service_id === serviceId;
    },

    work: async (order: Order): Promise<Deliverable<GauntletScorecard>> => {
      const input = order.requirement as unknown as GauntletInput;
      if (!input?.targetServiceId) {
        throw new Error('Missing required field: targetServiceId');
      }

      console.log(`[gauntlet] Received certification order for: ${input.targetServiceId}`);

      const scorecard = await runGauntlet({
        client,
        targetServiceId: input.targetServiceId,
      });

      console.log(`[gauntlet] Generating PDF scorecard...`);
      const pdfBuffer = await composeScorecardPdf(scorecard);
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
