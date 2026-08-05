#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_ASSETS = [
  {
    label: 'Airport_Jetway.glb',
    bytes: 31_459_796,
    sha256: '562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0',
  },
  {
    label: 'Jetway_albedo.jpg',
    bytes: 4_374_151,
    sha256: 'ded6dbad1930417349bd11a2b22de6f5aa6c89a0b9ef8241b1978ea092f37ed0',
  },
  {
    label: 'Jetway_metallic.png',
    bytes: 9_300_055,
    sha256: '7deac7f078fd2ea28dcd6a88d47a9b2baf55503c7730c3b6846afb11178b7b8c',
  },
  {
    label: 'Jetway_normal.png',
    bytes: 10_763_430,
    sha256: '9319dca63343e55ade0be00f06facf9cbc26dabb432f21240e9aa9781b53a6b1',
  },
  {
    label: 'Jetway_AO.jpg',
    bytes: 3_529_816,
    sha256: '85f8368e13fcf27b7eab3d9b19a554065311df0980566a8e2c8fb3690391011c',
  },
  {
    label: 'Glass_JW_normal.png',
    bytes: 1_107_961,
    sha256: '823cf53bfeaf1bb11fdcfbb7235a456032e5e7d4bea07e2901354ba9e923e794',
  },
  {
    label: 'Glass_JW_AO.jpg',
    bytes: 88_646,
    sha256: '391d039485a6139ddd3f82b97455970c897410f031320e0f04ef1c690415fe13',
  },
  {
    label: 'Glass_JW_emissive.jpg',
    bytes: 185_984,
    sha256: 'b04433a9724729d969bb8fee1b6ffc7c452773a228bbf13b44d1696fdff4cce9',
  },
];

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function collectCandidateFiles(directory, bySize) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectCandidateFiles(absolutePath, bySize);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    if (!bySize.has(fileStat.size)) {
      continue;
    }

    const candidates = bySize.get(fileStat.size);
    candidates.push(absolutePath);
  }
}

async function main() {
  const bySize = new Map();
  for (const asset of REQUIRED_ASSETS) {
    if (!bySize.has(asset.bytes)) {
      bySize.set(asset.bytes, []);
    }
  }

  await collectCandidateFiles(repoRoot, bySize);

  const verified = [];
  const missing = [];

  for (const asset of REQUIRED_ASSETS) {
    const candidates = bySize.get(asset.bytes) ?? [];
    let match = null;

    for (const candidate of candidates) {
      const bytes = await readFile(candidate);
      if (digest(bytes) === asset.sha256) {
        match = candidate;
        break;
      }
    }

    if (match) {
      verified.push({
        ...asset,
        path: path.relative(repoRoot, match),
      });
    } else {
      missing.push(asset);
    }
  }

  console.log(JSON.stringify({ verified, missing }, null, 2));

  if (missing.length > 0) {
    const names = missing.map((asset) => asset.label).join(', ');
    throw new Error(
      `[exact-airport-jetway] Runtime is blocked. Missing or hash-mismatched exact uploaded assets: ${names}`,
    );
  }

  console.log('[exact-airport-jetway] Exact GLB and all seven exact uploaded textures are present and hash-verified.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
