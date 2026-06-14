import { describe, it, expect, beforeEach } from 'vitest';
import { recordCertification, getCertification, certRegistry } from '../src/registry.js';

describe('Gauntlet Registry', () => {
  beforeEach(() => {
    certRegistry.clear();
  });

  it('records and retrieves certifications', () => {
    recordCertification('svc_1', 100, 7);
    const cert = getCertification('svc_1');
    expect(cert?.score).toBe(100);
    expect(cert?.passedCount).toBe(7);
  });

  it('evicts oldest entry when size exceeds MAX_REGISTRY_SIZE', () => {
    for (let i = 0; i < 1000; i++) {
      recordCertification(`svc_${i}`, 100, 7);
    }
    expect(certRegistry.size).toBe(1000);
    expect(getCertification('svc_0')).toBeDefined();

    // Adding 1001st element should evict the first one
    recordCertification('svc_1000', 100, 7);
    expect(certRegistry.size).toBe(1000);
    expect(getCertification('svc_0')).toBeUndefined();
    expect(getCertification('svc_1000')).toBeDefined();
  });

  it('does not evict if updating an existing entry at max size', () => {
    for (let i = 0; i < 1000; i++) {
      recordCertification(`svc_${i}`, 100, 7);
    }
    
    // Update existing
    recordCertification('svc_0', 50, 3);
    expect(certRegistry.size).toBe(1000);
    expect(getCertification('svc_0')?.score).toBe(50);
  });

  it('returns undefined for non-existent service', () => {
    expect(getCertification('non_existent')).toBeUndefined();
  });

  it('covers branches when oldestKey is undefined during eviction', () => {
    for (let i = 0; i < 1000; i++) {
      recordCertification(`svc_${i}`, 100, 7);
    }
    
    const keysSpy = vi.spyOn(certRegistry, 'keys').mockReturnValueOnce({
      next: () => ({ value: undefined, done: true })
    } as unknown as IterableIterator<string>);

    recordCertification('svc_1000', 100, 7);
    expect(certRegistry.size).toBe(1001);
    
    keysSpy.mockRestore();
  });
});
