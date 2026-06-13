export interface ProbeResult {
  name: string;
  passed: boolean;
  score: number; // 0-100
  durationMs: number;
  error?: string;
  details?: string;
}

export interface ProbeContext {
  targetServiceId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
}

export interface Probe {
  name: string;
  description: string;
  execute: (ctx: ProbeContext) => Promise<ProbeResult>;
}
