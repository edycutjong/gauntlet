// Define explicit contract for the client to eliminate loose 'any'
export interface CrooClient {
  uploadFile(buffer: Buffer, fileName: string): Promise<string>;
  [key: string]: unknown; // Allow other core methods
}

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
  client: CrooClient;
}

export interface Probe {
  name: string;
  description: string;
  execute: (ctx: ProbeContext) => Promise<ProbeResult>;
}
