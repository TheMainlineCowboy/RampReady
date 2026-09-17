# Exact KPHX source airport

This branch replaces RampReady's reconstructed PHX scenery with the user's exact KPHX 1.75.1 X-Plane scenery package from Google Drive `RampReady/New KPHX`.

Rules for this branch:

- WED / apt / SAM placements are source authority.
- Authored OBJ geometry and source textures are converted deterministically for the web; geometry is not procedurally redesigned.
- Source asset hashes are pinned before conversion.
- Generated runtime assets are verified by byte length and SHA-256 before use.
- The old layered Terminal 4 / A1 / pavement correction pipeline is not authoritative on this branch and must be removed as the exact source airport becomes complete.
- GitHub Pages remains the deployment target after the source-airport branch passes visual and runtime verification.

Current ingest milestone: exact Terminal 4 North (`Terminals/Terminal4b.obj`) with its authored day and LIT textures and WED placement. Terminal 4 South and the rest of the airport follow through the same source-driven pipeline.
