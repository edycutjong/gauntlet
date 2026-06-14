/**
 * Gauntlet — Entry point.
 *
 * Starts the certification provider loop and an HTTP server that serves a
 * health check and a dynamic certification badge (/badge?serviceId=...).
 *
 * Required env vars:
 * - CROO_SDK_KEY — required in LIVE mode (omit when CROO_MOCK=true)
 * - GAUNTLET_SERVICE_ID — registered service ID
 *
 * Optional:
 * - PORT — health/badge server port (default 8080)
 * - CROO_MOCK=true — offline mock mode
 */

import { isMockMode, makeClient } from '@edycutjong/croo-core';
import { startGauntletProvider } from './provider.js';
import * as http from 'http';
import { getCertification } from './registry.js';

export * from './provider.js';
export * from './runner.js';
export * from './probes/index.js';

function generateBadgeSvg(serviceId: string, record?: ReturnType<typeof getCertification>): string {
  let statusText = 'UNTESTED';
  let color = '#475569'; // Slate (Grey)

  if (record) {
    const isPerfect = record.score === 100;
    const isPassing = record.score >= 70;
    statusText = isPassing ? `CERTIFIED ${record.score}/100` : `FAILED ${record.score}/100`;
    color = isPerfect ? '#10B981' : (isPassing ? '#F59E0B' : '#EF4444'); 
  }

  // Dynamic widths for a crisp GitHub README shield
  const leftWidth = 75;
  const charWidth = 7;
  const rightWidth = statusText.length * charWidth + 20;
  const totalWidth = leftWidth + rightWidth;

  const leftCenter = (leftWidth / 2) * 10;
  const rightCenter = (leftWidth + rightWidth / 2) * 10;
  const leftTextLength = (leftWidth - 20) * 10;
  const rightTextLength = (rightWidth - 20) * 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img" aria-label="Gauntlet: ${statusText}">
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r">
      <rect width="${totalWidth}" height="28" rx="4" fill="#fff"/>
    </clipPath>
    <g clip-path="url(#r)">
      <rect width="${leftWidth}" height="28" fill="#1E293B"/>
      <rect x="${leftWidth}" width="${rightWidth}" height="28" fill="${color}"/>
      <rect width="${totalWidth}" height="28" fill="url(#s)"/>
    </g>
    <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100">
      <text aria-hidden="true" x="${leftCenter}" y="195" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${leftTextLength}">GAUNTLET</text>
      <text x="${leftCenter}" y="185" transform="scale(.1)" fill="#fff" textLength="${leftTextLength}">GAUNTLET</text>
      <text aria-hidden="true" x="${rightCenter}" y="195" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${rightTextLength}">${statusText}</text>
      <text x="${rightCenter}" y="185" transform="scale(.1)" fill="#fff" textLength="${rightTextLength}">${statusText}</text>
    </g>
  </svg>`;
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  ⚔️  Gauntlet — Certification Agent       ║');
  console.log('║  7-probe adversarial testing              ║');
  console.log(`║  Mode: ${isMockMode() ? '🧪 MOCK' : '🔴 LIVE (Base Mainnet)'}              ║`);
  console.log('╚══════════════════════════════════════════╝');

  const sdkKey = process.env.CROO_SDK_KEY;
  if (!sdkKey && !isMockMode()) {
    throw new Error('CROO_SDK_KEY is required unless CROO_MOCK=true');
  }

  const client = makeClient(sdkKey || 'croo_sk_mock_gauntlet');
  const serviceId = process.env.GAUNTLET_SERVICE_ID ?? 'svc_gauntlet_certifier';

  // Start HTTP Server
  const port = process.env.PORT || 8080;
  const healthServer = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    
    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'gauntlet', timestamp: new Date().toISOString() }));
      return;
    }

    if (parsedUrl.pathname === '/badge') {
      const targetId = parsedUrl.searchParams.get('serviceId');
      if (!targetId) {
        res.writeHead(400);
        return res.end('Missing serviceId parameter');
      }
      
      // Strict XSS Sanitization
      const safeId = targetId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const record = getCertification(safeId);
      const svg = generateBadgeSvg(safeId, record);
      
      // Anti-caching headers to bypass GitHub's camo image proxy
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.end(svg);
    }

    res.writeHead(404);
    res.end();
  });

  healthServer.listen(port, () => {
    console.log(`[Lifecycle] 🩺 Health & Badge server bound to port ${port}`);
  });

  console.log(`[gauntlet] Starting provider on ${serviceId}...`);
  await startGauntletProvider(client, serviceId);
}

// Only auto-start if this file is run directly
if (import.meta.url.endsWith(process.argv[1])) {
  main().catch((err) => {
    console.error('[gauntlet] Fatal error:', err);
    process.exit(1);
  });
}
