import fs from "node:fs";
import path from "node:path";

const [bglArg, inspectionArg] = process.argv.slice(2);
if (!bglArg || !inspectionArg) {
  throw new Error("Usage: node scripts/decode-kphx-runways.mjs <KPHX_ADEX.BGL> <inspection.json>");
}

const data = fs.readFileSync(path.resolve(bglArg));
const inspectionPath = path.resolve(inspectionArg);
const inspection = JSON.parse(fs.readFileSync(inspectionPath, "utf8"));

const u8 = (offset) => data.readUInt8(offset);
const u16 = (offset) => data.readUInt16LE(offset);
const u32 = (offset) => data.readUInt32LE(offset);
const f32 = (offset) => data.readFloatLE(offset);
const lonDeg = (raw) => raw * (360 / (3 * 0x10000000)) - 180;
const latDeg = (raw) => 90 - raw * (180 / (2 * 0x10000000));
const charFor = (value) => {
  if (value === 0) return " ";
  if (value >= 2 && value <= 11) return String.fromCharCode(48 + value - 2);
  if (value >= 12 && value <= 37) return String.fromCharCode(65 + value - 12);
  return "?";
};
const decodeIcao = (raw) => {
  let value = raw >>> 5;
  if (!value) return "";
  const chars = [];
  while (value > 37) {
    const next = value % 38;
    chars.unshift(charFor(next));
    value = Math.floor((value - next) / 38);
  }
  chars.unshift(charFor(value));
  return chars.join("").trim();
};
const designators = ["", "L", "R", "C", "W", "A", "B"];
const runwayName = (number, designator) => `${number < 10 ? `0${number}` : number}${designators[designator] ?? ""}`;
const MARKINGS = Object.freeze({
  EDGES: 1 << 0,
  THRESHOLD: 1 << 1,
  FIXED_DISTANCE: 1 << 2,
  TOUCHDOWN: 1 << 3,
  DASHES: 1 << 4,
  IDENT: 1 << 5,
  PRECISION: 1 << 6,
  EDGE_PAVEMENT: 1 << 7,
  SINGLE_END: 1 << 8,
  PRIMARY_CLOSED: 1 << 9,
  SECONDARY_CLOSED: 1 << 10,
  PRIMARY_STOL: 1 << 11,
  SECONDARY_STOL: 1 << 12,
  ALTERNATE_THRESHOLD: 1 << 13,
  ALTERNATE_FIXEDDISTANCE: 1 << 14,
  ALTERNATE_TOUCHDOWN: 1 << 15,
});

function markingNames(flags) {
  return Object.entries(MARKINGS).filter(([, bit]) => (flags & bit) === bit).map(([name]) => name);
}

function parseRunway(recordOffset, recordSize) {
  if (recordSize < 52) throw new Error(`KPHX runway record at ${recordOffset} is only ${recordSize} bytes`);
  const markingFlags = u16(recordOffset + 48);
  const lightFlags = u8(recordOffset + 50);
  const runway = {
    sourceByteOffset: recordOffset,
    sourceByteLength: recordSize,
    surface: u16(recordOffset + 6) & 0x7fff,
    primary: runwayName(u8(recordOffset + 8), u8(recordOffset + 9)),
    secondary: runwayName(u8(recordOffset + 10), u8(recordOffset + 11)),
    primaryIlsIdent: decodeIcao(u32(recordOffset + 12)),
    secondaryIlsIdent: decodeIcao(u32(recordOffset + 16)),
    longitude: lonDeg(u32(recordOffset + 20)),
    latitude: latDeg(u32(recordOffset + 24)),
    altitudeMeters: u32(recordOffset + 28) / 1000,
    lengthMeters: f32(recordOffset + 32),
    widthMeters: f32(recordOffset + 36),
    headingDegrees: f32(recordOffset + 40),
    patternAltitudeMeters: f32(recordOffset + 44),
    markingFlags,
    markingNames: markingNames(markingFlags),
    lightFlags,
    edgeLightIntensity: lightFlags & 0x03,
    centerLightIntensity: (lightFlags & 0x0c) >>> 2,
    centerLightsRedAtEnd: Boolean(lightFlags & 0x20),
    patternFlags: u8(recordOffset + 51),
    primaryOffsetThresholdMeters: 0,
    secondaryOffsetThresholdMeters: 0,
    primaryBlastPadMeters: 0,
    secondaryBlastPadMeters: 0,
    primaryOverrunMeters: 0,
    secondaryOverrunMeters: 0,
  };

  const extensionKey = new Map([
    [0x0005, "primaryOffsetThresholdMeters"],
    [0x0006, "secondaryOffsetThresholdMeters"],
    [0x0007, "primaryBlastPadMeters"],
    [0x0008, "secondaryBlastPadMeters"],
    [0x0009, "primaryOverrunMeters"],
    [0x000a, "secondaryOverrunMeters"],
  ]);
  let child = recordOffset + 52;
  const end = recordOffset + recordSize;
  while (child + 6 <= end) {
    const id = u16(child);
    const size = u32(child + 2);
    if (size < 6 || child + size > end) break;
    const key = extensionKey.get(id);
    if (key && size >= 16) runway[key] = f32(child + 8);
    child += size;
  }
  return runway;
}

if (data.length < 0x38 || u32(0) !== 0x19920201 || u32(4) !== 0x38) {
  throw new Error("KPHX runway decoder received a non-FSX BGL");
}
const sectionCount = u32(0x14);
let airportSection = null;
for (let index = 0; index < sectionCount; index += 1) {
  const offset = 0x38 + index * 20;
  const type = u32(offset);
  if (type !== 0x03) continue;
  const flags = u32(offset + 4);
  airportSection = {
    subsectionCount: u32(offset + 8),
    subsectionOffset: u32(offset + 12),
    subsectionSize: ((flags & 0x10000) | 0x40000) >>> 14,
  };
  break;
}
if (!airportSection) throw new Error("KPHX runway decoder found no airport section");

let selectedRunways = null;
for (let subIndex = 0; subIndex < airportSection.subsectionCount && !selectedRunways; subIndex += 1) {
  const subsection = airportSection.subsectionOffset + subIndex * airportSection.subsectionSize;
  if (subsection + airportSection.subsectionSize > data.length) break;
  const recordCount = u32(subsection + 4);
  const dataOffset = u32(subsection + 8);
  const dataEnd = Math.min(data.length, dataOffset + u32(subsection + 12));
  let cursor = dataOffset;
  for (let recordIndex = 0; recordIndex < Math.max(recordCount, 1) && cursor + 0x38 <= dataEnd; recordIndex += 1) {
    const id = u16(cursor);
    const size = u32(cursor + 2);
    if (id !== 0x003c || size < 0x38 || cursor + size > dataEnd) break;
    const icao = decodeIcao(u32(cursor + 0x28));
    if (icao === "KPHX") {
      const runways = [];
      let child = cursor + 0x38;
      const end = cursor + size;
      while (child + 6 <= end) {
        const childId = u16(child);
        const childSize = u32(child + 2);
        if (childSize < 6 || child + childSize > end) break;
        if (childId === 0x0004) runways.push(parseRunway(child, childSize));
        child += childSize;
      }
      selectedRunways = runways;
      break;
    }
    cursor += size;
  }
}
if (!selectedRunways) throw new Error("KPHX runway decoder did not find the KPHX airport record");
if (selectedRunways.length !== 3) throw new Error(`Expected 3 KPHX runways, decoded ${selectedRunways.length}`);
for (const runway of selectedRunways) {
  if (!(runway.lengthMeters > 2000 && runway.widthMeters >= 30)) {
    throw new Error(`Decoded runway ${runway.primary}/${runway.secondary} has invalid dimensions ${runway.lengthMeters} x ${runway.widthMeters}`);
  }
}

inspection.selected.runways = selectedRunways;
inspection.decodedCounts = { ...(inspection.decodedCounts || {}), runways: selectedRunways.length };
inspection.runwayDecoder = {
  schemaVersion: 1,
  authority: "FSX KPHX_ADEX.BGL runway subrecords 0x0004",
  markingFlagAuthority: "atools FSX BGL RunwayMarkings",
  decodedAtUtc: new Date().toISOString(),
};
fs.writeFileSync(inspectionPath, `${JSON.stringify(inspection, null, 2)}\n`);
console.log(JSON.stringify({ runways: selectedRunways }, null, 2));
