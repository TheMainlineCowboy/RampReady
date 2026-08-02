# Why the supplied scenery cannot be served byte-for-byte

RampReady runs in a browser. The supplied scenery package contains legacy simulator BGL/MDLX records and BMP/DDS textures, which browsers cannot execute or render directly. The correct browser pipeline is therefore:

1. decode the package's authored model geometry;
2. convert its original textures and lightmaps without redesigning them;
3. decode the package's airport placements and headings;
4. preserve one shared coordinate frame for the terminal, parking stands, ground and jetways;
5. add only simulator interaction rigs that are absent from the package.

The prior build violated step 4 by fitting A1 to the wrong broad facade point and violated step 2/3 intent by covering the converted terminal with cloned procedural lower-facade modules. This repair removes those substitutes and measures the A1 connector against the converted source triangles.

The package references stock `AIR_Jetway01` by GUID rather than embedding Microsoft's original skinned jetway mesh. The original stock mesh cannot be recovered from this scenery archive alone; the current articulated bridge remains a disclosed replacement until an authorized equivalent mesh is available.
