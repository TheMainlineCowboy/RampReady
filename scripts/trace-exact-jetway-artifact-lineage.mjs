#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY || "TheMainlineCowboy/RampReady";
if (!token) throw new Error("GITHUB_TOKEN is required");
const [owner, repo] = repository.split("/");
const artifactIds = [8910277326, 8871924395, 8936240943, 8857178238];
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "RampReady-exact-jetway-lineage",
};
async function api(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) return { error: response.status, body: (await response.text()).slice(0, 500) };
  return response.json();
}
for (const id of artifactIds) {
  const artifact = await api(`https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${id}`);
  console.log(`LINEAGE_ARTIFACT ${id} ${JSON.stringify(artifact)}`);
  const runId = artifact?.workflow_run?.id;
  if (!runId) continue;
  const run = await api(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`);
  console.log(`LINEAGE_RUN ${id} ${JSON.stringify({id:run?.id,name:run?.name,event:run?.event,status:run?.status,conclusion:run?.conclusion,head_branch:run?.head_branch,head_sha:run?.head_sha,path:run?.path,workflow_id:run?.workflow_id,run_number:run?.run_number,created_at:run?.created_at,updated_at:run?.updated_at,html_url:run?.html_url,error:run?.error})}`);
  const siblings = await api(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=100`);
  console.log(`LINEAGE_SIBLINGS ${id} ${JSON.stringify((siblings?.artifacts||[]).map(a=>({id:a.id,name:a.name,size:a.size_in_bytes,expired:a.expired,created_at:a.created_at})))}`);
  const jobs = await api(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`);
  console.log(`LINEAGE_JOBS ${id} ${JSON.stringify((jobs?.jobs||[]).map(j=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion,started_at:j.started_at,completed_at:j.completed_at,steps:(j.steps||[]).map(s=>({name:s.name,conclusion:s.conclusion}))})))}`);
}
const caches = await api(`https://api.github.com/repos/${owner}/${repo}/actions/caches?per_page=100&sort=last_accessed_at&direction=desc`);
const filtered = (caches?.actions_caches||[]).filter(c=>/jetway|airport|playwright|vite|node|npm|asset|model|exact/i.test(c.key));
console.log(`LINEAGE_CACHES ${JSON.stringify(filtered.map(c=>({id:c.id,key:c.key,ref:c.ref,size:c.size_in_bytes,created_at:c.created_at,last_accessed_at:c.last_accessed_at,version:c.version})))}`);
