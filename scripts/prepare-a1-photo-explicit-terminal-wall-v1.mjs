// Final compatibility entrypoint for the Aug. 15 A1 wall resolver.
// The photographic facade identity MUST be installed before the explicit wall
// endpoint is measured. The old ordering applied the BGATE1 filter only after
// the wall, remote Rotunda and dogleg had already been constructed, allowing a
// stale wrong-side/perpendicular terminal attachment to survive visually.

await import(`./prepare-a1-bgate1-facade-identity-early-v1.mjs?early-wall=${Date.now()}`);
await import(`./prepare-a1-photo-explicit-terminal-wall-v2.mjs?compat=${Date.now()}`);

console.log("Prepared A1 explicit terminal wall with the BGATE1 photo-identity lock installed before wall resolution; no late stale-wall fallback is permitted.");
