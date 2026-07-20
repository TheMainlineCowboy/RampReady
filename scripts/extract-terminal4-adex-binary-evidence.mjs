import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_BLOB_SHA = 'fa185427e154eb92058e755b9fbdb1ad799317ed';
const PRINTABLE_MIN = 4;
const GATE_LABEL_CONTEXT_RADIUS_BYTES = 24;
const TERMINAL4_GATE_LABEL = /(?:^|[^A-Z0-9])([AB](?:[1-9]|1[0-9]|2[0-9]|30))(?![A-Z0-9])/gi;
export const REQUIRED_TERMINAL4_CORRIDOR_LABELS = [
  ...Array.from({ length: 15 }, (_, index) => `B${15 - index}`),
  'A1',
];

export function calculateGitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(buffer).digest('hex');
}

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

function buildByteContext(buffer, sourceByteOffset, byteLength) {
  if (!buffer) return null;
  const startByteOffset = Math.max(0, sourceByteOffset - GATE_LABEL_CONTEXT_RADIUS_BYTES);
  const endByteOffsetExclusive = Math.min(
    buffer.length,
    sourceByteOffset + byteLength + GATE_LABEL_CONTEXT_RADIUS_BYTES,
  );
  const bytes = buffer.subarray(startByteOffset, endByteOffsetExclusive);

  return {
    startByteOffset,
    endByteOffsetExclusive,
    byteLength: bytes.length,
    labelOffsetWithinContext: sourceByteOffset - startByteOffset,
    hex: bytes.toString('hex'),
    ascii: [...bytes]
      .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'))
      .join(''),
  };
}

export function extractGateLabelEvidence(printableStrings, sourceBuffer = null) {
  const evidence = [];

  for (const record of printableStrings) {
    TERMINAL4_GATE_LABEL.lastIndex = 0;
    let match;
    while ((match = TERMINAL4_GATE_LABEL.exec(record.value)) !== null) {
      const label = match[1].toUpperCase();
      const labelIndex = match.index + match[0].lastIndexOf(match[1]);
      const sourceByteOffset = record.sourceByteOffset + labelIndex;
      evidence.push({
        label,
        labelByteLength: Buffer.byteLength(label, 'ascii'),
        sourceByteOffset,
        sourceStringOffset: record.sourceByteOffset,
        sourceStringIndex: labelIndex,
        sourceString: record.value,
        byteContext: buildByteContext(
          sourceBuffer,
          sourceByteOffset,
          Buffer.byteLength(label, 'ascii'),
        ),
        status: 'candidate-label-only-not-linked-to-parking-record',
      });
    }
  }

  return evidence.sort((left, right) =>
    left.sourceByteOffset - right.sourceByteOffset || left.label.localeCompare(right.label),
  );
}

export function summarizeGateLabelEvidence(
  evidence,
  requiredLabels = REQUIRED_TERMINAL4_CORRIDOR_LABELS,
) {
  const occurrencesByLabel = new Map();
  for (const record of evidence) {
    const offsets = occurrencesByLabel.get(record.label) ?? [];
    offsets.push(record.sourceByteOffset);
    occurrencesByLabel.set(record.label, offsets);
  }

  const labels = [...occurrencesByLabel.entries()]
    .map(([label, sourceByteOffsets]) => ({
      label,
      occurrenceCount: sourceByteOffsets.length,
      sourceByteOffsets,
      status: 'candidate-label-occurrences-only-not-linked-to-parking-record',
    }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));

  const requiredCoverage = requiredLabels.map((label) => ({
    label,
    candidateOccurrenceCount: occurrencesByLabel.get(label)?.length ?? 0,
    candidateLabelPresent: occurrencesByLabel.has(label),
    status: 'candidate-label-presence-only-not-parking-record-coverage',
  }));

  return {
    uniqueCandidateLabelCount: labels.length,
    totalCandidateOccurrenceCount: evidence.length,
    labels,
    requiredCorridorLabels: [...requiredLabels],
    requiredCoverage,
    allRequiredCandidateLabelsPresent: requiredCoverage.every(({ candidateLabelPresent }) => candidateLabelPresent),
    interpretation: 'Presence only confirms printable label evidence; it does not prove a parking-record relationship.',
  };
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
  const actualGitBlobSha = calculateGitBlobSha(buffer);
  const strings = extractPrintableStrings(buffer);
  const identityEvidence = strings.filter(({ value }) =>
    /KPHX|Phoenix Sky Harbor|PHOENIX/i.test(value),
  );
  const candidateGateLabelEvidence = extractGateLabelEvidence(strings, buffer);

  return {
    schemaVersion: 5,
    status: 'byte-evidence-only-not-decoded',
    source: {
      path: sourcePath,
      expectedGitBlobSha: EXPECTED_BLOB_SHA,
      actualGitBlobSha,
      matchesExpectedGitBlobSha: actualGitBlobSha === EXPECTED_BLOB_SHA,
      byteLength: buffer.length,
      sha256,
    },
    headerEvidence: readHeaderEvidence(buffer),
    printableStrings: strings,
    airportIdentityEvidence: identityEvidence,
    candidateGateLabelEvidence,
    candidateGateLabelSummary: summarizeGateLabelEvidence(candidateGateLabelEvidence),
    interpretationLimits: [
      'raw descriptors are preserved as unsigned little-endian integers without semantic labels',
      'printable strings and candidate gate labels are evidence only and are not parking records',
      'candidate gate labels include bounded raw-byte context for decoder research, not inferred record relationships',
      'candidate gate labels are not linked to coordinates, headings, radii or parking-record byte structures',
      'candidate corridor-label coverage reports printable evidence presence only, not parking-record completeness',
      'duplicate label occurrences remain preserved and must not be collapsed into a single parking stand',
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
  if (!evidence.source.matchesExpectedGitBlobSha) {
    throw new Error(
      `ADEX source Git blob SHA mismatch: expected ${EXPECTED_BLOB_SHA}, received ${evidence.source.actualGitBlobSha}.`,
    );
  }
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
