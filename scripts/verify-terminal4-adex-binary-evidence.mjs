import assert from 'node:assert/strict';
import { buildEvidence, extractPrintableStrings, readHeaderEvidence } from './extract-terminal4-adex-binary-evidence.mjs';

const fixture = Buffer.alloc(128);
fixture.writeUInt16LE(0x0201, 0);
fixture.writeUInt32LE(1, 20);
fixture.writeUInt32LE(0x11223344, 24);
fixture.writeUInt32LE(0x55667788, 28);
fixture.write('Phoenix Sky Harbor Intl', 64, 'ascii');
fixture.write('KPHX', 96, 'ascii');

const strings = extractPrintableStrings(fixture);
assert(strings.some((record) => record.value === 'Phoenix Sky Harbor Intl' && record.sourceByteOffset === 64));
assert(strings.some((record) => record.value === 'KPHX' && record.sourceByteOffset === 96));

const header = readHeaderEvidence(fixture);
assert.equal(header.magicUint16, 0x0201);
assert.equal(header.declaredDescriptorCount, 1);
assert.equal(header.rawDescriptors.length, 1);
assert.equal(header.rawDescriptors[0].sourceByteOffset, 24);
assert.deepEqual(header.rawDescriptors[0].rawUint32.slice(0, 2), [0x11223344, 0x55667788]);

const evidence = buildEvidence(fixture, 'scenery/KPHX_ADEX.BGL');
assert.equal(evidence.status, 'byte-evidence-only-not-decoded');
assert.equal(evidence.airportIdentityEvidence.length, 2);
assert.equal(evidence.source.byteLength, fixture.length);
assert.equal(evidence.source.sha256.length, 64);
assert(!('parkingRecords' in evidence));
assert(!('gateManifest' in evidence));
assert(evidence.interpretationLimits.some((rule) => rule.includes('no gate coordinates')));

assert.throws(() => readHeaderEvidence(Buffer.alloc(12)), /too small/);

console.log('Terminal 4 ADEX byte-evidence extractor verified.');
