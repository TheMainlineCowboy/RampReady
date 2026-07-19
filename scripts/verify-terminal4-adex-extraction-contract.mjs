import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contractPath = path.join(root, 'docs/environment/terminal4-adex-extraction-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

const fail = (message) => {
  console.error(`Terminal 4 ADEX extraction contract verification failed: ${message}`);
  process.exit(1);
};

if (contract.source?.repository !== 'TheMainlineCowboy/SkyHarborPhx') fail('unexpected source repository');
if (contract.source?.path !== 'scenery/KPHX_ADEX.BGL') fail('authoritative ADEX path is not pinned');
if (!/^[0-9a-f]{40}$/.test(contract.source?.gitBlobSha ?? '')) fail('source Git blob SHA is missing or invalid');
if (!contract.source.airportIdentityEvidence?.includes('KPHX')) fail('KPHX identity evidence is missing');
if (contract.corridor?.startGate !== 'B15' || contract.corridor?.endGate !== 'A1') fail('corridor limits changed');
if (contract.corridor?.coordinatesMayBeGuessed !== false) fail('coordinate guessing must remain prohibited');
if (contract.corridor?.headingsMayBeGuessed !== false) fail('heading guessing must remain prohibited');

const requiredRecords = new Set(contract.requiredExtractionOutput?.records ?? []);
for (const phrase of [
  'all decoded parking records with source byte offsets',
  'latitude and longitude in source precision',
  'source heading and radius',
  'taxiway paths and nodes needed to validate pushback clearance'
]) {
  if (!requiredRecords.has(phrase)) fail(`required extraction record missing: ${phrase}`);
}

const provenance = new Set(contract.requiredExtractionOutput?.provenanceFields ?? []);
for (const field of ['sourceGitBlobSha', 'sourceByteOffset', 'decoderName', 'decoderVersion', 'manualCorrectionHistory']) {
  if (!provenance.has(field)) fail(`required provenance field missing: ${field}`);
}

const rules = (contract.validationRules ?? []).join('\n').toLowerCase();
for (const required of ['source blob sha differs', 'source byte offsets', 'do not populate aircraft, tug, stop or turn poses from visual estimation']) {
  if (!rules.includes(required)) fail(`validation rule missing: ${required}`);
}

const releaseBlocks = (contract.releaseBlocks ?? []).join('\n').toLowerCase();
if (!releaseBlocks.includes('scenario gate selection remains disabled')) fail('scenario gate selection is not blocked');
if (!releaseBlocks.includes('github pages remains the only production host')) fail('GitHub Pages exclusivity is not preserved');

console.log('Terminal 4 ADEX extraction contract verified.');
