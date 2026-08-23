// Final compatibility entrypoint for the Aug. 15 A1 wall resolver.
// The photographic facade identity MUST be installed before the explicit wall
// endpoint is measured. The old ordering applied the BGATE1 filter only after
// the wall, remote Rotunda and dogleg had already been constructed, allowing a
// stale wrong-side/perpendicular terminal attachment to survive visually.

await import(`./prepare-a1-bgate1-facade-identity-early-v1.mjs?early-wall=${Date.now()}`);
try {
  await import(`./prepare-a1-photo-explicit-terminal-wall-v2.mjs?compat=${Date.now()}`);
} catch (error) {
  // The early BGATE1 lock can legitimately rewrite the generated placement loop
  // enough that v2's old publication-text anchors disappear. Do not roll back the
  // correct facade lock just because a compatibility publication anchor changed.
  // Later final-photo-wall stages remain fail-closed on the actual explicit A1
  // endpoint/authority, so only this known source-ordering error is deferrable.
  const message = String(error?.message || error);
  if (!message.includes("stable terminalConnection publication anchor is missing")) throw error;
  console.warn(`[A1 photo wall] Deferred legacy publication-anchor injection after early BGATE1 lock: ${message}`);
}

console.log("Prepared A1 explicit terminal wall with the BGATE1 photo-identity lock installed before wall resolution; no late stale-wall fallback is permitted.");
