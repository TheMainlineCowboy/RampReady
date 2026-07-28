# Verification requirements

The updated airport pass is not releasable unless all of the following are true:

- build and full repository verification succeed
- A1 is the runtime anchor
- B15L and B15M are both present
- the runtime publishes KPHX version 1.8.1
- the source jetway count is 112
- the Terminal 4 A/B runtime contains 58 stands and 58 jetways
- the browser renders the airport without GLTF, WebGL, reference or type errors
- pushback lifecycle verification remains green
- a composited browser screenshot is inspected before merge
