"use strict";

// Repack PNG compression only. Keep dimensions, filtered pixel bytes, and every metadata chunk.
const fs = require("node:fs");
const zlib = require("node:zlib");
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function optimizePNG(input) {
  if (!input.subarray(0, 8).equals(signature)) return input;
  const chunks = [], imageData = [];
  for (let offset = 8; offset < input.length;) {
    const length = input.readUInt32BE(offset), end = offset + length + 12;
    if (end > input.length) throw new Error("Truncated PNG chunk");
    const chunk = input.subarray(offset, end), type = chunk.toString("ascii", 4, 8);
    chunks.push({ type, chunk });
    if (type === "IDAT") imageData.push(chunk.subarray(8, -4));
    offset = end;
  }
  const pixels = zlib.inflateSync(Buffer.concat(imageData));
  const compressed = zlib.deflateSync(pixels, { level: 9 });
  if (!zlib.inflateSync(compressed).equals(pixels)) throw new Error("PNG verification failed");
  const chunk = Buffer.alloc(compressed.length + 12);
  chunk.writeUInt32BE(compressed.length);
  chunk.write("IDAT", 4);
  compressed.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  let written = false;
  const output = Buffer.concat([signature, ...chunks.flatMap(item => {
    if (item.type !== "IDAT") return [item.chunk];
    if (written) return [];
    written = true;
    return [chunk];
  })]);
  return output.length < input.length ? output : input;
}

if (require.main === module) {
  let before = 0, after = 0;
  for (const file of process.argv.slice(2)) {
    const input = fs.readFileSync(file), output = optimizePNG(input);
    before += input.length; after += output.length;
    if (output !== input) fs.writeFileSync(file, output);
    console.log(`${file}: ${input.length} → ${output.length} bytes`);
  }
  console.log(`Total: ${before} → ${after} bytes; saved ${before - after} bytes`);
}

module.exports = { optimizePNG };
