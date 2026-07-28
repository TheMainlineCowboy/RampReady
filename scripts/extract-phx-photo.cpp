// Deterministic extractor for the source PHXPhoto.bgl aerial-photo layer.
// Built in CI against seanisom/flightsimlib at the pinned commit recorded in
// scripts/build-phx-photo-mosaic.py. The source package is user-provided.

#include "BglDecompressor.h"

#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using flightsimlib::io::CBglDecompressor;

#pragma pack(push, 1)
struct BglHeader {
  uint16_t version;
  uint16_t magic;
  uint32_t headerSize;
  uint64_t fileTime;
  uint32_t qmidMagic;
  uint32_t layerCount;
  uint32_t parents[8];
};

struct LayerPointer {
  int32_t type;
  uint16_t dataClass;
  uint16_t hasQmidHigh;
  uint32_t tileCount;
  uint32_t streamOffset;
  uint32_t sizeBytes;
};

struct TilePointer20 {
  uint32_t qmidLow;
  uint32_t qmidHigh;
  uint32_t reserved;
  uint32_t streamOffset;
  uint32_t sizeBytes;
};

struct Trq1Header {
  uint32_t version;
  uint32_t size;
  uint16_t dataType;
  uint8_t compressionData;
  uint8_t compressionMask;
  uint32_t qmidLow;
  uint32_t qmidHigh;
  uint32_t variations;
  uint16_t cols;
  uint16_t colsPadding;
  uint16_t rows;
  uint16_t rowsPadding;
  uint32_t sizeData;
  uint32_t sizeMask;
};
#pragma pack(pop)

struct Bounds {
  int level = 0;
  uint32_t u = 0;
  uint32_t v = 0;
  double west = 0;
  double south = 0;
  double east = 0;
  double north = 0;
};

static bool qmidBounds(uint32_t low, uint32_t high, Bounds& out) {
  const uint64_t packed = (static_cast<uint64_t>(high) << 32) | low;
  for (int level = 30; level >= 2; --level) {
    const int marker = 2 * level + 1;
    if ((packed >> marker) != 1ULL) continue;
    uint32_t u = 0;
    uint32_t v = 0;
    for (int bit = 0; bit < level; ++bit) {
      const uint64_t pair = (packed >> (2 * bit)) & 3ULL;
      u |= static_cast<uint32_t>(pair & 1ULL) << bit;
      v |= static_cast<uint32_t>((pair >> 1) & 1ULL) << bit;
    }
    const double rows = static_cast<double>(1ULL << (level - 1));
    out.level = level;
    out.u = u;
    out.v = v;
    out.west = -180.0 + u * (240.0 / rows);
    out.east = out.west + 240.0 / rows;
    out.north = 90.0 - v * (180.0 / rows);
    out.south = out.north - 180.0 / rows;
    return true;
  }
  return false;
}

static std::string hex8(uint32_t value) {
  std::ostringstream output;
  output << std::hex << std::setfill('0') << std::setw(8) << value;
  return output.str();
}

template <class T>
static bool readAt(std::ifstream& input, uint64_t offset, T& value) {
  input.clear();
  input.seekg(static_cast<std::streamoff>(offset));
  input.read(reinterpret_cast<char*>(&value), sizeof(value));
  return static_cast<bool>(input);
}

static bool decodeLzThen(
  const std::vector<uint8_t>& compressed,
  uint8_t compression,
  std::vector<uint8_t>& intermediate
) {
  if (compressed.size() < sizeof(int)) return false;
  int intermediateSize = 0;
  std::memcpy(&intermediateSize, compressed.data(), sizeof(intermediateSize));
  if (intermediateSize <= 0 || intermediateSize > 32 * 1024 * 1024) return false;
  intermediate.resize(static_cast<size_t>(intermediateSize));
  const int written = compression == 3 || compression == 7
    ? CBglDecompressor::DecompressLz1(
        intermediate.data(), intermediateSize, compressed.data() + sizeof(int), static_cast<int>(compressed.size()))
    : CBglDecompressor::DecompressLz2(
        intermediate.data(), intermediateSize, compressed.data() + sizeof(int), static_cast<int>(compressed.size()));
  return written == intermediateSize;
}

static bool decodePhoto(
  const Trq1Header& header,
  const std::vector<uint8_t>& compressed,
  std::vector<uint8_t>& packed
) {
  packed.resize(static_cast<size_t>(header.cols) * header.rows * 2);
  int written = -1;
  if (header.compressionData == 10) {
    written = CBglDecompressor::DecompressPtc(
      packed.data(), static_cast<int>(packed.size()), compressed.data(), static_cast<int>(compressed.size()),
      header.rows, header.cols, 4, 2);
  } else if (header.compressionData == 3 || header.compressionData == 5) {
    std::vector<uint8_t> intermediate;
    if (decodeLzThen(compressed, header.compressionData, intermediate)) {
      written = CBglDecompressor::DecompressDelta(
        packed.data(), static_cast<int>(packed.size()), intermediate.data());
    }
  }
  return written == static_cast<int>(packed.size());
}

static bool decodeMask(
  const Trq1Header& header,
  const std::vector<uint8_t>& compressed,
  std::vector<uint8_t>& mask
) {
  mask.assign(static_cast<size_t>(header.cols) * header.rows, 255);
  if (compressed.empty()) return true;
  if (header.compressionMask != 7 && header.compressionMask != 9) return false;
  std::vector<uint8_t> intermediate;
  if (!decodeLzThen(compressed, header.compressionMask, intermediate)) return false;
  const int written = CBglDecompressor::DecompressBitPack(
    mask.data(), static_cast<int>(mask.size()), intermediate.data(), static_cast<int>(intermediate.size()),
    header.rows, header.cols);
  return written == static_cast<int>(mask.size());
}

int main(int argc, char** argv) {
  if (argc != 3) {
    std::cerr << "usage: extract-phx-photo PHXPhoto.bgl output-directory\n";
    return 2;
  }

  const std::filesystem::path sourcePath = argv[1];
  const std::filesystem::path outputDirectory = argv[2];
  std::filesystem::create_directories(outputDirectory);
  std::ifstream input(sourcePath, std::ios::binary);
  if (!input) {
    std::cerr << "Unable to open PHXPhoto.bgl\n";
    return 3;
  }

  BglHeader bgl{};
  if (!readAt(input, 0, bgl) || bgl.version != 0x0201 || bgl.magic != 0x1992 || bgl.headerSize != 56) {
    std::cerr << "Unexpected PHXPhoto.bgl header\n";
    return 4;
  }

  std::vector<LayerPointer> layers(bgl.layerCount);
  input.seekg(bgl.headerSize);
  input.read(reinterpret_cast<char*>(layers.data()), static_cast<std::streamsize>(layers.size() * sizeof(LayerPointer)));
  const LayerPointer* dayLayer = nullptr;
  for (const auto& layer : layers) {
    if (layer.type == 0x8C) dayLayer = &layer;
  }
  if (!dayLayer || dayLayer->tileCount == 0 || dayLayer->sizeBytes / dayLayer->tileCount != 20) {
    std::cerr << "The source BGL has no supported daytime photo layer\n";
    return 5;
  }

  std::vector<TilePointer20> pointers(dayLayer->tileCount);
  input.seekg(dayLayer->streamOffset);
  input.read(reinterpret_cast<char*>(pointers.data()), static_cast<std::streamsize>(pointers.size() * sizeof(TilePointer20)));

  std::ofstream manifest(outputDirectory / "tiles.csv");
  manifest << "index,level,u,v,qmidLow,qmidHigh,width,height,west,south,east,north,variations,file\n";
  int decoded = 0;

  for (size_t index = 0; index < pointers.size(); ++index) {
    const auto& pointer = pointers[index];
    Bounds bounds{};
    if (!qmidBounds(pointer.qmidLow, pointer.qmidHigh, bounds) || bounds.level != 17) continue;

    Trq1Header header{};
    if (!readAt(input, pointer.streamOffset, header) || header.version != 0x31515254 ||
        header.size != sizeof(Trq1Header) || header.dataType != 1 || header.cols != 256 || header.rows != 256) {
      std::cerr << "Invalid level-17 TRQ1 record at pointer " << index << "\n";
      return 6;
    }

    std::vector<uint8_t> compressedData(header.sizeData);
    input.seekg(pointer.streamOffset + sizeof(Trq1Header));
    input.read(reinterpret_cast<char*>(compressedData.data()), static_cast<std::streamsize>(compressedData.size()));
    std::vector<uint8_t> packedPhoto;
    if (!decodePhoto(header, compressedData, packedPhoto)) {
      std::cerr << "Unable to decode photo tile " << index << "\n";
      return 7;
    }

    std::vector<uint8_t> compressedMask(header.sizeMask);
    if (!compressedMask.empty()) {
      input.read(reinterpret_cast<char*>(compressedMask.data()), static_cast<std::streamsize>(compressedMask.size()));
    }
    std::vector<uint8_t> mask;
    if (!decodeMask(header, compressedMask, mask)) {
      std::cerr << "Unable to decode photo mask " << index << "\n";
      return 8;
    }

    std::vector<uint8_t> rgba(static_cast<size_t>(header.cols) * header.rows * 4);
    for (size_t pixel = 0; pixel < mask.size(); ++pixel) {
      uint16_t value = 0;
      std::memcpy(&value, packedPhoto.data() + pixel * 2, sizeof(value));
      rgba[pixel * 4 + 0] = static_cast<uint8_t>((value >> 7) & 0xF8);
      rgba[pixel * 4 + 1] = static_cast<uint8_t>((value >> 2) & 0xF8);
      rgba[pixel * 4 + 2] = static_cast<uint8_t>((value << 3) & 0xF8);
      const unsigned packedAlpha = (value & 0x8000) ? 255U : 0U;
      rgba[pixel * 4 + 3] = static_cast<uint8_t>(mask[pixel] * packedAlpha / 255U);
    }

    const std::string fileName = "L17-" + hex8(pointer.qmidHigh) + hex8(pointer.qmidLow) + ".rgba";
    std::ofstream tile(outputDirectory / fileName, std::ios::binary);
    tile.write(reinterpret_cast<const char*>(rgba.data()), static_cast<std::streamsize>(rgba.size()));
    manifest << index << ',' << bounds.level << ',' << bounds.u << ',' << bounds.v << ','
             << pointer.qmidLow << ',' << pointer.qmidHigh << ',' << header.cols << ',' << header.rows << ','
             << std::setprecision(15) << bounds.west << ',' << bounds.south << ',' << bounds.east << ','
             << bounds.north << ',' << header.variations << ',' << fileName << '\n';
    ++decoded;
  }

  if (decoded != 199) {
    std::cerr << "Expected 199 level-17 photo tiles, decoded " << decoded << "\n";
    return 9;
  }
  std::cout << "Decoded " << decoded << " highest-resolution PHX photo tiles.\n";
  return 0;
}
