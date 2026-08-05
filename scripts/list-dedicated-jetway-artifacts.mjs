#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY || "TheMainlineCowboy/RampReady";
if (!token) throw new Error("GITHUB_TOKEN is required");
const targetBranches = new Set([
  "agent/jetway-source-binary-staging",
  "transfer/jetway-blob-validation",
  "fix/exact-airport-jetway-glb",
]);
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "RampReady-dedicated-jetway-artifact-inventory",
};
const matches = [];
for (let page = 1; page <= 30; page += 1) {
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  for (const artifact of payload.artifacts) {
    const branch = artifact.workflow_run?.head_branch || "";
    if (targetBranches.has(branch) || /jetway.*(?:source|blob|binary|upload|asset|exact)|(?:source|blob|binary|upload|asset|exact).*jetway/i.test(artifact.name)) {
      matches.push(artifact);
    }
  }
  if (payload.artifacts.length < 100) break;
}
matches.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
console.log(`JETWAY_DEDICATED_ARTIFACT_COUNT ${matches.length}`);
for (const artifact of matches) {
  console.log(`JETWAY_DEDICATED_ARTIFACT ${JSON.stringify({
    id: artifact.id,
    name: artifact.name,
    size: artifact.size_in_bytes,
    expired: artifact.expired,
    createdAt: artifact.created_at,
    branch: artifact.workflow_run?.head_branch,
    sha: artifact.workflow_run?.head_sha,
    runId: artifact.workflow_run?.id,
  })}`);
}
