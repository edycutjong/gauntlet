import PDFDocument from 'pdfkit';
import type { GauntletScorecard } from './runner.js';

export async function composeScorecardPdf(scorecard: GauntletScorecard): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      doc.fontSize(24).fillColor('#06b6d4').text('CROO Gauntlet Scorecard', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).fillColor('#ffffff');
      doc.text(`Target Agent: ${scorecard.targetServiceId}`);
      doc.text(`Timestamp: ${scorecard.timestamp}`);
      doc.text(`Passed Probes: ${scorecard.passedCount} / ${scorecard.totalProbes}`);
      doc.text(`Final Score: ${scorecard.totalScore}/100`);
      doc.moveDown(2);

      doc.fontSize(18).text('Probe Results:');
      doc.moveDown();

      for (const result of scorecard.results) {
        doc.fontSize(14).text(`${result.name.toUpperCase()} - ${result.passed ? 'PASS' : 'FAIL'} (${result.durationMs}ms)`);
        doc.fontSize(12).fillColor('#94a3b8');
        if (result.passed) {
          doc.text(`Details: ${result.details || 'OK'}`);
        } else {
          doc.text(`Error: ${result.error || 'Failed'}`);
        }
        doc.moveDown();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
