import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_BLOB_SHA = 'fa185427e154eb92058e755b9fbdb1ad799317ed';
const PRINTABLE_MIN = 4;

export function extractPrintableStrings(buffer, minimumLength = PRINTABLE_MIN) {
  const records = [];
  let start = -1;

  for (let offset = 0; offset <= buffer.length; offset += 1) {
    const byte = offset < buffer.length ? buffer[offset] : 0;
    const printable = byte >= 0x20 && byte <= 0x7e;

    if (printable && start === -1) start = offset;
    if ((!printable || offset === buffer.length) && start !== -1) {
      const length = offset - start;
      if (length >= minimumLength) {
        records.push({
          sourceByteOffset: start,
          byteLength: length,
          value: buffer.subarray(start, offset).toString('ascii'),
        });
      }
      start = -1;
    }
  }

  return records;
}

export function readHeaderEvidence(buffer) {
  if (buffer.length < 64) throw new Error('ADEX source is too small to contain a BGL header.');

  const uint16 = (offset) => buffer.readUInt16LE(offset);
  const uint32 = (offset) => buffer.readUInt32LE(offset);
  const descriptorCount = Math.min(uint32(20), 256);
  const descriptorStart = 24;
  const descriptorSize = 20;
  const descriptors = [];

  for (let index = 0; index < descriptorCount; index += 1) {
    const offset = descriptorStart + index * descriptorSize;
    if (offset + descriptorSize > buffer.length) break;
    descriptors.push({
      index,
      sourceByteOffset: offset,
      rawUint32: [0, 4, 8, 12, 16].map((relative) => uint32(offset + relative)),
    });
  }

  return {
    sourceByteOffset: 0,
    magicUint16: uint16(0),
    headerUint16: Array.from({ length: 8 }, (_, index) => uint16(index * 2)),
    headerUint32: Array.from({ length: 8 }, (_, index) => uint32(index * 4)),
    declaredDescriptorCount: descriptorCount,
    descriptorSizeBytes: descriptorSize,
    rawDescriptors: descriptors,
  };
}

export function buildEvidence(buffer, sourcePath) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const strings = extractPrintableStrings(buffer);
  const identityEvidence = strings.filter(({ value }) =>
    /KPHX|Phoenix Sky Harbor|PHOENIX/i.test(value),
  );

  return {
    schemaVersion: 1,
    status: 'byte-evidence-only-not-decoded',
    source: {
      path: sourcePath,
      expectedGitBlobSha: EXPECTED_BLOB_SHA,
      byteLength: buffer.length,
      sha256,
    },
    headerEvidence: readHeaderEvidence(buffer),
    printableStrings: strings,
    airportIdentityEvidence: identityEvidence,
    interpretationLimits: [
      'raw descriptors are preserved as unsigned little-endian integers without semantic labels',
      'printable strings are evidence only and are not parking or gate records',
      'no gate coordinates, headings, taxi paths or object placements are emitted',
      'a format-aware decoder is still required before populating the Terminal 4 gate manifest',
    ],
  };
}

async function main() {
  const source = process.argv[2];
  const output = process.argv[3] ?? 'artifacts/terminal4-adex-binary-evidence.json';
  if (!source) {
    throw new Error('Usage: node scripts/extract-terminal4-adex-binary-evidence.mjs <KPHX_ADEX.BGL> [output.json]');
  }

  const buffer = await readFile(source);
  const evidence = buildEvidence(buffer, source);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Wrote byte-level ADEX evidence to ${output}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
