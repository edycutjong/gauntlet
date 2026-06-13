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

describe('Gauntlet Provider', () => {
  it('registers the provider loop', () => {
    startGauntletProvider({}, 'svc_gauntlet');
    expect(crooCore.runProvider).toHaveBeenCalled();
  });

  it('runs the gauntlet and uploads the scorecard', async () => {
    startGauntletProvider({}, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    expect(config.serviceMatch({ service_id: 'svc_gauntlet', type: '', negotiation_id: '' })).toBe(true);

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

    const client = { uploadFile: vi.fn().mockResolvedValue('https://mock.croo.network/files/mock.pdf') };
    
    // Simulate order
    const order = {
      id: 'o_gauntlet',
      service_id: 'svc_gauntlet',
      status: 'paid' as const,
      requirement: { targetServiceId: 'svc_target' },
    };

    // Replace the client in the context
    vi.mocked(crooCore.runProvider).mockClear();
    startGauntletProvider(client, 'svc_gauntlet');
    const configWithClient = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    const result = await configWithClient.work(order);

    expect(runner.runGauntlet).toHaveBeenCalledWith({
      client,
      targetServiceId: 'svc_target',
    });
    expect(composer.composeScorecardPdf).toHaveBeenCalled();
    expect(client.uploadFile).toHaveBeenCalledWith(mockBuffer, expect.stringContaining('scorecard_svc_target_'));
    expect(result.data.pdfUrl).toBe('https://mock.croo.network/files/mock.pdf');
  });

  it('throws if targetServiceId is missing', async () => {
    startGauntletProvider({}, 'svc_gauntlet');
    const config = vi.mocked(crooCore.runProvider).mock.calls[0][1];

    const order = {
      id: 'o_gauntlet',
      service_id: 'svc_gauntlet',
      status: 'paid' as const,
      requirement: {}, // missing targetServiceId
    };

    await expect(config.work(order)).rejects.toThrow(/Missing or invalid required field: targetServiceId/);
  });
});
