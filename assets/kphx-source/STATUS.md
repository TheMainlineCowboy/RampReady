# Source KPHX replacement status

- Repository: private
- Branch: `feat/source-kphx-airport`
- Old PR #164: superseded, draft, unmerged
- Source authority: Google Drive `RampReady/New KPHX`, KPHX 1.75.1 plus required libraries
- Coordinate authority: `earth.wed.xml`, `Earth nav data/apt.dat`, `sam.xml`
- Current exact runtime ingest: Terminal 4 North (`Terminals/Terminal4b.obj`) with `Terminal4b_comb.dds` and `Terminal4b_LIT.dds`
- Next bounded source ingest: Terminal 4 South, then Terminal 4 jetways/gate support, ground polygons/markings, remaining airport objects, and required library-resolved objects
- Acceptance rule: no reconstructed airport geometry is accepted as authoritative once the corresponding exact source scenery is ingested.
