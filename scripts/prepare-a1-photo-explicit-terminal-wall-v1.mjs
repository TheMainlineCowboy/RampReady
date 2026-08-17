// Compatibility entrypoint retained for existing production call sites.
// The v2 publisher uses the stable terminalConnection object instead of the
// retired legacy validator-copy anchor, while preserving the v1 authority token
// consumed by downstream A1 photo/runtime contracts.
await import(`./prepare-a1-photo-explicit-terminal-wall-v2.mjs?compat=${Date.now()}`);
