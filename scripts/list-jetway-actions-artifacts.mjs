#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY || "TheMainlineCowboy/RampReady";
if (!token) throw new Error("GITHUB_TOKEN is required");

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "RampReady-exact-jetway-artifact-recovery",
};

const artifacts = [];
for (let page = 1; page <= 20; page += 1) {
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`, { headers });
  if (!response.ok) throw new Error(`Artifact listing failed: HTTP ${response.status} ${await response.text()}`);
  const payload = await response.json();
  artifacts.push(...payload.artifacts);
  if (payload.artifacts.length < 100) break;
}

const candidates = artifacts
  .filter((artifact) => !artifact.expired)
  .filter((artifact) => /jetway|airport|source|exact|a1|render|screenshot|evidence|build|pages|asset/i.test(artifact.name) || artifact.size_in_bytes >= 1_000_000)
  .sort((a, b) => b.size_in_bytes - a.size_in_bytes);

console.log(`JETWAY_ACTIONS_ARTIFACT_TOTAL ${artifacts.length}`);
console.log(`JETWAY_ACTIONS_ARTIFACT_ACTIVE_CANDIDATES ${candidates.length}`);
for (const artifact of candidates.slice(0, 300)) {
  console.log(`JETWAY_ACTIONS_ARTIFACT ${JSON.stringify({
    id: artifact.id,
    name: artifact.name,
    size: artifact.size_in_bytes,
    expired: artifact.expired,
    createdAt: artifact.created_at,
    updatedAt: artifact.updated_at,
    workflowRunId: artifact.workflow_run?.id,
    workflowRunHeadBranch: artifact.workflow_run?.head_branch,
    workflowRunHeadSha: artifact.workflow_run?.head_sha,
  })}`);
}
