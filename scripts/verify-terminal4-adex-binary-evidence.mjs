import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildEvidence,
  calculateGitBlobSha,
  extractGateLabelEvidence,
  extractPrintableStrings,
  readHeaderEvidence,
} from './extract-terminal4-adex-binary-evidence.mjs';

const fixture = Buffer.alloc(192);
fixture.writeUInt16LE(0x0201, 0);
fixture.writeUInt32LE(1, 20);
fixture.writeUInt32LE(0x11223344, 24);
fixture.writeUInt32LE(0x55667788, 28);
fixture.write('Phoenix Sky Harbor Intl', 64, 'ascii');
fixture.write('KPHX', 96, 'ascii');
fixture.write('Terminal 4 gates A1 A10 B15', 112, 'ascii');
fixture.write('NOTA100 XB15Z', 160, 'ascii');

const strings = extractPrintableStrings(fixture);
assert(strings.some((record) => record.value === 'Phoenix Sky Harbor Intl' && record.sourceByteOffset === 64));
assert(strings.some((record) => record.value === 'KPHX' && record.sourceByteOffset === 96));

const labels = extractGateLabelEvidence(strings);
assert.deepEqual(labels.map(({ label }) => label), ['A1', 'A10', 'B15']);
assert.deepEqual(labels.map(({ sourceByteOffset }) => sourceByteOffset), [129, 132, 136]);
assert(labels.every(({ status }) => status === 'candidate-label-only-not-linked-to-parking-record'));
assert(!labels.some(({ label }) => label === 'A100'));

const header = readHeaderEvidence(fixture);
assert.equal(header.magicUint16, 0x0201);
assert.equal(header.declaredDescriptorCount, 1);
assert.equal(header.rawDescriptors.length, 1);
assert.equal(header.rawDescriptors[0].sourceByteOffset, 24);
assert.deepEqual(header.rawDescriptors[0].rawUint32.slice(0, 2), [0x11223344, 0x55667788]);

const expectedFixtureBlobSha = createHash('sha1')
  .update(Buffer.from(`blob ${fixture.length}\0`, 'utf8'))
  .update(fixture)
  .digest('hex');
assert.equal(calculateGitBlobSha(fixture), expectedFixtureBlobSha);

const evidence = buildEvidence(fixture, 'scenery/KPHX_ADEX.BGL');
assert.equal(evidence.schemaVersion, 3);
assert.equal(evidence.status, 'byte-evidence-only-not-decoded');
assert.equal(evidence.airportIdentityEvidence.length, 2);
assert.equal(evidence.candidateGateLabelEvidence.length, 3);
assert.equal(evidence.source.byteLength, fixture.length);
assert.equal(evidence.source.sha256.length, 64);
assert.equal(evidence.source.actualGitBlobSha, expectedFixtureBlobSha);
assert.equal(evidence.source.matchesExpectedGitBlobSha, false);
assert(!('parkingRecords' in evidence));
assert(!('gateManifest' in evidence));
assert(evidence.interpretationLimits.some((rule) => rule.includes('not linked to coordinates')));
assert(evidence.interpretationLimits.some((rule) => rule.includes('no gate coordinates')));

assert.throws(() => readHeaderEvidence(Buffer.alloc(12)), /too small/);

console.log('Terminal 4 ADEX byte, Git blob and gate-label evidence extractor verified.');
