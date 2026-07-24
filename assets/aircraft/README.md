# Authored aircraft runtime source

`crj700-user.glb.br` is the deterministic Brotli-compressed source for the user-supplied American Eagle aircraft. `scripts/materialize-authored-aircraft.mjs` verifies its compressed and decompressed hashes before writing `public/models/crj700-user.glb` for builds and runtime verification.
