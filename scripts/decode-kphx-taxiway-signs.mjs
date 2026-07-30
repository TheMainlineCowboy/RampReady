import fs from "node:fs";
import path from "node:path";

const [bglArg, inspectionArg] = process.argv.slice(2);
if (!bglArg || !inspectionArg) throw new Error("Usage: node decode-kphx-taxiway-signs.mjs <KPHX_ADEX.BGL> <inspection.json>");
const bglPath = path.resolve(bglArg);
const inspectionPath = path.resolve(inspectionArg);
const data = fs.readFileSync(bglPath);
const inspection = JSON.parse(fs.readFileSync(inspectionPath, "utf8"));
const u8 = (offset) => data.readUInt8(offset);
const u16 = (offset) => data.readUInt16LE(offset);
const u32 = (offset) => data.readUInt32LE(offset);
const f32 = (offset) => data.readFloatLE(offset);
const lonDeg = (raw) => raw * (360 / (3 * 0x10000000)) - 180;
const latDeg = (raw) => 90 - raw * (180 / (2 * 0x10000000));
const angle16 = (raw) => raw * 360 / 0x10000;
const cleanLabel = (value) => value.replace(/\0.*$/s, "").trim();
const printableRatio = (value) => value.length ? [...value].filter((char) => { const code = char.charCodeAt(0); return code >= 32 && code <= 126; }).length / value.length : 0;
const plausiblePosition = (longitude, latitude) => longitude > -113 && longitude < -111 && latitude > 32.5 && latitude < 34.5;
const plausibleLabel = (label) => label.length > 0 && label.length <= 64 && printableRatio(label) > 0.94 && /[A-Za-z0-9]/.test(label);
const readCString = (start, end) => {
  let cursor = start;
  while (cursor < end && data[cursor] !== 0) cursor += 1;
  return { value: data.toString("ascii", start, cursor), next: Math.min(end, cursor + 1) };
};

if (data.length < 0x38 || u32(0) !== 0x19920201 || u32(4) !== 0x38) throw new Error("KPHX taxiway sign decoder received a non-FSX BGL");
const sectionCount = u32(0x14);
let airportSection = null;
for (let index = 0; index < sectionCount; index += 1) {
  const offset = 0x38 + index * 20;
  if (u32(offset) !== 0x03) continue;
  const flags = u32(offset + 4);
  airportSection = {
    subsectionCount: u32(offset + 8),
    subsectionOffset: u32(offset + 12),
    subsectionSize: ((flags & 0x10000) | 0x40000) >>> 14,
  };
  break;
}
if (!airportSection) throw new Error("KPHX taxiway sign decoder found no airport section");

const records = [];
for (let subIndex = 0; subIndex < airportSection.subsectionCount; subIndex += 1) {
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
    const icaoRaw = u32(cursor + 0x28);
    let value = icaoRaw >>> 5;
    const chars = [];
    const charFor = (entry) => entry === 0 ? " " : entry >= 2 && entry <= 11 ? String.fromCharCode(48 + entry - 2) : entry >= 12 && entry <= 37 ? String.fromCharCode(65 + entry - 12) : "?";
    while (value > 37) { const next = value % 38; chars.unshift(charFor(next)); value = Math.floor((value - next) / 38); }
    if (value) chars.unshift(charFor(value));
    const icao = chars.join("").trim();
    if (icao === "KPHX") {
      let child = cursor + 0x38;
      const end = cursor + size;
      while (child + 6 <= end) {
        const childId = u16(child);
        const childSize32 = u32(child + 2);
        if (childSize32 < 6 || child + childSize32 > end) break;
        if (childId === 0x0039) records.push({ offset: child, size: childSize32 });
        child += childSize32;
      }
    }
    cursor += size;
  }
}
if (!records.length) throw new Error("KPHX taxiway sign decoder found no 0x0039 source records");

function parseDirect(record, variant) {
  const start = record.offset;
  const end = start + record.size;
  let longitude;
  let latitude;
  let headingDegrees;
  let size;
  let justification;
  let labelStart;
  if (variant === "fsx-airport-direct-v1") {
    longitude = lonDeg(u32(start + 6));
    latitude = latDeg(u32(start + 10));
    headingDegrees = angle16(u16(start + 14));
    size = u8(start + 16);
    justification = u8(start + 17);
    labelStart = start + 18;
  } else if (variant === "fsx-airport-direct-v2") {
    longitude = lonDeg(u32(start + 8));
    latitude = latDeg(u32(start + 12));
    headingDegrees = angle16(u16(start + 16));
    size = u8(start + 18);
    justification = u8(start + 19);
    labelStart = start + 20;
  } else {
    longitude = lonDeg(u32(start + 8));
    latitude = latDeg(u32(start + 12));
    headingDegrees = f32(start + 16) * 360 / 0x10000;
    size = u8(start + 20);
    justification = u8(start + 21) & 1;
    labelStart = start + 22;
  }
  const label = cleanLabel(data.toString("ascii", labelStart, end));
  const valid = plausiblePosition(longitude, latitude) && Number.isFinite(headingDegrees) && headingDegrees >= 0 && headingDegrees <= 360 && size <= 5 && justification <= 3 && plausibleLabel(label);
  return { variant, valid, longitude, latitude, headingDegrees, size, justification, label };
}

function parseSceneryGroup(record) {
  const start = record.offset;
  const size16 = u16(start + 2);
  const end = Math.min(start + record.size, start + size16);
  if (size16 < 52 || end > data.length) return { variant: "fsx-scenery-group", valid: false, reason: `invalid size16 ${size16}` };
  const originLongitude = lonDeg(u32(start + 4));
  const originLatitude = latDeg(u32(start + 8));
  const groupHeadingDegrees = angle16(u16(start + 22));
  const count = u32(start + 44);
  if (!plausiblePosition(originLongitude, originLatitude) || !(count > 0 && count < 500)) {
    return { variant: "fsx-scenery-group", valid: false, originLongitude, originLatitude, count };
  }
  const signs = [];
  let cursor = start + 48;
  for (let index = 0; index < count && cursor + 13 <= end; index += 1) {
    const longitudeBias = f32(cursor);
    const latitudeBias = f32(cursor + 4);
    const headingDegrees = angle16(u16(cursor + 8));
    const size = u8(cursor + 10);
    const justification = u8(cursor + 11);
    const labelResult = readCString(cursor + 12, end);
    const label = cleanLabel(labelResult.value);
    let next = labelResult.next;
    if (label.length % 2 === 0 && next < end) next += 1;
    signs.push({ index, longitudeBias, latitudeBias, headingDegrees, size, justification, label });
    cursor = next;
  }
  const validSigns = signs.filter((sign) => Number.isFinite(sign.longitudeBias) && Number.isFinite(sign.latitudeBias) && Math.abs(sign.longitudeBias) < 1 && Math.abs(sign.latitudeBias) < 1 && sign.headingDegrees >= 0 && sign.headingDegrees <= 360 && sign.size <= 5 && sign.justification <= 3 && plausibleLabel(sign.label));
  return {
    variant: "fsx-scenery-group",
    valid: validSigns.length === count && cursor <= end,
    originLongitude,
    originLatitude,
    groupHeadingDegrees,
    count,
    bytesConsumed: cursor - start,
    recordBytes: end - start,
    signs,
  };
}

const decoded = [];
const evidence = [];
for (const record of records) {
  const candidates = [
    parseSceneryGroup(record),
    parseDirect(record, "fsx-airport-direct-v1"),
    parseDirect(record, "fsx-airport-direct-v2"),
    parseDirect(record, "msfs-airport-direct-v1"),
  ];
  const chosen = candidates.find((candidate) => candidate.valid);
  evidence.push({ ...record, rawHex: data.subarray(record.offset, Math.min(record.offset + record.size, record.offset + 160)).toString("hex"), candidates });
  if (!chosen) continue;
  if (chosen.variant === "fsx-scenery-group") {
    for (const sign of chosen.signs) {
      decoded.push({
        sourceRecordOffset: record.offset,
        sourceRecordSize: record.size,
        sourceFormat: chosen.variant,
        longitude: chosen.originLongitude + sign.longitudeBias,
        latitude: chosen.originLatitude + sign.latitudeBias,
        headingDegrees: sign.headingDegrees,
        size: sign.size,
        justification: sign.justification,
        label: sign.label,
        groupOrigin: { longitude: chosen.originLongitude, latitude: chosen.originLatitude, headingDegrees: chosen.groupHeadingDegrees },
        biases: { longitude: sign.longitudeBias, latitude: sign.latitudeBias },
      });
    }
  } else {
    decoded.push({
      sourceRecordOffset: record.offset,
      sourceRecordSize: record.size,
      sourceFormat: chosen.variant,
      longitude: chosen.longitude,
      latitude: chosen.latitude,
      headingDegrees: chosen.headingDegrees,
      size: chosen.size,
      justification: chosen.justification,
      label: chosen.label,
    });
  }
}

inspection.selected.taxiwaySignRecordCount = records.length;
inspection.selected.taxiwaySigns = decoded;
inspection.selected.taxiwaySignEvidence = evidence;
inspection.decodedCounts = { ...(inspection.decodedCounts || {}), taxiwaySignRecords: records.length, taxiwaySigns: decoded.length };
fs.writeFileSync(inspectionPath, `${JSON.stringify(inspection, null, 2)}\n`, "utf8");
if (!decoded.length) {
  const compactEvidence = evidence.map(({ offset, size, rawHex, candidates }) => ({
    offset,
    size,
    rawHex,
    candidates: candidates.map((candidate) => ({
      variant: candidate.variant,
      valid: candidate.valid,
      reason: candidate.reason,
      originLongitude: candidate.originLongitude,
      originLatitude: candidate.originLatitude,
      count: candidate.count,
      longitude: candidate.longitude,
      latitude: candidate.latitude,
      headingDegrees: candidate.headingDegrees,
      size: candidate.size,
      justification: candidate.justification,
      label: candidate.label,
      signs: candidate.signs,
    })),
  }));
  console.error(`KPHX_SIGN_EVIDENCE=${JSON.stringify(compactEvidence)}`);
  throw new Error(`KPHX taxiway sign decoder could not validate any of ${records.length} source records`);
}
console.log(JSON.stringify({ sourceRecords: records.length, decodedSigns: decoded.length, formats: [...new Set(decoded.map((sign) => sign.sourceFormat))], labels: decoded.map((sign) => sign.label) }, null, 2));
