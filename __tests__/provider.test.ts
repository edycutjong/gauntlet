/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { startGauntletProvider } from '../src/provider.js';
import * as crooCore from '@edycutjong/croo-core';
import * as runner from '../src/runner.js';
import * as composer from '../src/composer.js';

vi.mock('@edycutjong/croo-core', () => {
  return {
    runProvider: vi.fn(),
  };
});

vi.mock('../src/runner.js', () => ({
  runGauntlet: vi.fn(),
}));

vi.mock('../src/composer.js', () => ({
  composeScorecardPdf: vi.fn(),
}));

/** SDK-shaped Order (camelCase, no inline requirement). */
function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'o_gauntlet',
    negotiationId: 'n1',
    serviceId: 'svc_gauntlet',
    status: 'paid' as const,
    ...overrides,
  };
}

/** Client whose negotiation carries `requirement`, plus a configurable uploadFile. */
function makeClient(requirement: unknown, opts: { uploadOk?: boolean } = {}) {
  const { uploadOk = true } = opts;
  return {
    getNegotiation: vi.fn().mockResolvedValue({
      negotiationId: 'n1',
      requirements: typeof requirement === 'string' ? requirement : JSON.stringify(requirement),
    }),
    uploadFile: uploadOk
      ? vi.fn().mockResolvedValue('https://mock.croo.network/files/mock.pdf')
      : vi.fn().mockRejectedValue(new Error('Upload failed')),
  };
}

describe('Gauntlet Provider', () => {
  it('registers the provider loop', () => {
    startGauntletProvider({}, 'svc_gauntlet');
    expect(crooCore.runProvider).toHaveBeenCalled();
  });

  it('runs the gauntlet and uploads the scorecard', async () => {
    vi.mocked(runner.runGauntlet).mockResolvedValue({
      targetServiceId: 'svc_target',
      totalScore: 100,
      passedCount: 7,
      totalProbes: 7,
      timestamp: '2026',
      results: [],
    });

    const mockBuffer = Buffer.from('mock pdf');
    vi.mocked(composer.composeScorecardPdf).mockResolvedValue(mockBuffer);

    const client = makeClient({ targetServiceId: 'svc_target' });

    startGauntletProvider(client, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    expect(config.serviceMatch({ service_id: 'svc_gauntlet', type: '', negotiation_id: '' })).toBe(true);

    const result = await config.work(makeOrder());

    expect(client.getNegotiation).toHaveBeenCalledWith('n1');
    expect(runner.runGauntlet).toHaveBeenCalledWith({ client, targetServiceId: 'svc_target' });
    expect(composer.composeScorecardPdf).toHaveBeenCalled();
    // SDK signature is uploadFile(fileName, body).
    expect(client.uploadFile).toHaveBeenCalledWith(expect.stringContaining('scorecard_svc_target_'), mockBuffer);
    expect(result.data.pdfUrl).toBe('https://mock.croo.network/files/mock.pdf');
  });

  it('throws if targetServiceId is missing', async () => {
    const client = makeClient({}); // negotiation with no targetServiceId
    startGauntletProvider(client, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    await expect(config.work(makeOrder())).rejects.toThrow(/Missing or invalid required field: targetServiceId/);
  });

  it('rejects invalid requirement format (non-object JSON)', async () => {
    const client = makeClient('"just-a-string"'); // valid JSON, but not an object
    startGauntletProvider(client, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    await expect(config.work(makeOrder())).rejects.toThrow('Invalid requirement format: Expected JSON object');
  });

  it('rejects malformed (non-JSON) requirements', async () => {
    const client = makeClient('not-json-at-all');
    startGauntletProvider(client, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    await expect(config.work(makeOrder())).rejects.toThrow('Invalid requirement format: Expected JSON object');
  });

  it('throws if the negotiation cannot be loaded', async () => {
    const client = { getNegotiation: vi.fn().mockRejectedValue(new Error('boom')), uploadFile: vi.fn() };
    startGauntletProvider(client, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    await expect(config.work(makeOrder())).rejects.toThrow('Failed to load negotiation');
  });

  it('rejects oversized targetServiceId', async () => {
    const client = makeClient({ targetServiceId: 'A'.repeat(129) });
    startGauntletProvider(client, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    await expect(config.work(makeOrder())).rejects.toThrow('Security Violation: targetServiceId exceeds maximum length');
  });

  it('queues tasks when semaphore is full and warns on failed pdf upload', async () => {
    vi.mocked(runner.runGauntlet).mockResolvedValue({ targetServiceId: 'svc', totalScore: 100, passedCount: 1, totalProbes: 1, timestamp: '2026', results: [] });
    vi.mocked(composer.composeScorecardPdf).mockResolvedValue(Buffer.from('pdf'));

    // Derive a distinct targetServiceId per order from its negotiationId.
    const client = {
      getNegotiation: vi.fn().mockImplementation(async (negId: string) => ({
        negotiationId: negId,
        requirements: JSON.stringify({ targetServiceId: negId }),
      })),
      uploadFile: vi.fn().mockRejectedValue(new Error('Upload failed')),
    };

    startGauntletProvider(client, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    // Trigger 4 concurrent works to exercise the semaphore (max is 3).
    const results = await Promise.all([
      config.work(makeOrder({ negotiationId: '1' })),
      config.work(makeOrder({ negotiationId: '2' })),
      config.work(makeOrder({ negotiationId: '3' })),
      config.work(makeOrder({ negotiationId: '4' })),
    ]);

    expect(results[0].data.pdfUrl).toBeUndefined(); // Upload failed → schema-only
  });

  it('covers serviceMatch boundary cases', () => {
    startGauntletProvider({}, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    expect(config.serviceMatch(null as any)).toBe(false);
    expect(config.serviceMatch('not-an-object' as any)).toBe(false);
    expect(config.serviceMatch([] as any)).toBe(false);
    expect(config.serviceMatch({} as any)).toBe(false);
  });
});
