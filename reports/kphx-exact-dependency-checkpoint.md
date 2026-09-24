# KPHX 1.75.1 exact dependency checkpoint

Authority: user-supplied KPHX 1.75.1 source package
WED SHA-256: `59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498`

## X-Plane target lock

The exact `earth.wed.xml` was written by **WED 2.6.0r2** and stores:

- `doc/export_target = 7`
- generated `apt.dat` revision `1200`

In the WED 2.6 export-target enum:

- 0 = X-Plane 9
- 1 = X-Plane 10.00
- 2 = X-Plane 10.21
- 3 = X-Plane 10.50
- 4 = X-Plane 11.00
- 5 = X-Plane 11.30
- 6 = X-Plane 12.00
- **7 = X-Plane 12.1.2**

Therefore all `lib/` resources used by KPHX must be resolved against the **X-Plane 12.1.2 default library**, not XP11 and not a current/latest substitute.

## Completed exact dependency families

- KPHX package-owned resources
- MisterX_Library exact object materialization
- ZDP_Library exact object + surface materialization
- CDB-Library: **7 resources / 53 placements / 0 failures**
- OpenSceneryX stairs: **1 resource / 4 placements**, pinned to immutable official OpenSceneryX source

## Remaining exact source requirements

### RA Library
- Version authority: **RA Library v1.2**
- KPHX uses:
  - `RA_Library/Ground/objects/zRock03_A.obj`
- Placements: **12**
- State: source version pinned; original package download is account-gated and no authoritative raw source copy is currently staged.

### Fruit Stand Aircraft Library
- Version authority: **Fruit Stand Aircraft Library v3.0**
- KPHX uses:
  - `Fruitstand_Aircraft/A306F_UPS.obj`
  - `Fruitstand_Aircraft/DH8B_XLK.obj`
  - `Fruitstand_Aircraft/SF340_CSQ.obj`
- Placements: **3**
- State: source version pinned; original package download is account-gated and no authoritative raw source copy is currently staged.

### OpenSceneryX dirt polygon
- KPHX uses:
  - `opensceneryx/polygons/surfaces/dirt/1.pol`
- Placements: **1**
- Exact OpenSceneryX source is pinned, but the polygon references Laminar default-library decals:
  - `lib/g10/decals/grass_and_stony_dirt_1.dcl`
  - `lib/g10/decals/low_freq_mod_1.dcl`
- State: complete only after the XP12.1.2 default library is staged.

### X-Plane default library
Authoritative unresolved audit:
- **133 unique `lib/` resources**
- **1,840 placements**
- Formats:
  - 1,149 OBJ placements
  - 282 FAC placements
  - 230 LIN placements
  - 74 NET placements
  - 52 STR placements
  - 26 AGP placements
  - 22 FOR placements
  - 5 POL placements

Source requirement:
- exact **X-Plane 12.1.2** default-library art tree
- do not substitute XP11 files
- do not substitute current/latest XP12 assets without byte/source verification
- do not approximate unsupported FAC/NET/FOR/STR/AGP resources with custom geometry

## Next exact action

Stage or otherwise obtain the X-Plane 12.1.2 default-library source tree, resolve only the 133 WED-referenced `lib/` resources plus recursively referenced textures/decals/children, materialize by format, verify zero unresolved references, then close the OpenSceneryX dirt polygon.
