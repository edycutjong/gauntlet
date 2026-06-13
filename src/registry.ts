export interface CertRecord {
  score: number;
  passedCount: number;
  timestamp: number;
}

// Spatial-bounded LRU Cache to prevent OOM on the PaaS
const MAX_REGISTRY_SIZE = 1000;
export const certRegistry = new Map<string, CertRecord>();

export function recordCertification(serviceId: string, score: number, passedCount: number) {
  if (certRegistry.size >= MAX_REGISTRY_SIZE && !certRegistry.has(serviceId)) {
    // Evict the oldest entry to protect V8 heap
    const oldestKey = certRegistry.keys().next().value;
    if (oldestKey) certRegistry.delete(oldestKey);
  }
  certRegistry.set(serviceId, { score, passedCount, timestamp: Date.now() });
}

export function getCertification(serviceId: string): CertRecord | undefined {
  return certRegistry.get(serviceId);
}
